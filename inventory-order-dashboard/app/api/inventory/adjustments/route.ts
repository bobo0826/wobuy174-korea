import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const adjustmentReasons = ["盤點差異", "採購入庫", "損壞報廢", "樣品領用", "其他調整"];

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const nonZeroInteger = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number !== 0 ? number : null;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;

    const { data, error } = await getSupabaseAdmin()
      .from("inventory_adjustments")
      .select("id, product_id, quantity_change, reason, note, performed_by, created_at, products(name, sku)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ adjustments: data ?? [] }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法讀取庫存異動。" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const body = await request.json();
    const productId = text(body.productId);
    const quantityChange = nonZeroInteger(body.quantityChange);
    const reason = text(body.reason);
    const note = text(body.note);

    if (!uuidPattern.test(productId)) return NextResponse.json({ message: "請選擇已建立的商品。" }, { status: 400 });
    if (quantityChange === null) return NextResponse.json({ message: "異動數量必須為非零整數。" }, { status: 400 });
    if (!adjustmentReasons.includes(reason)) return NextResponse.json({ message: "異動原因不正確。" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("apply_inventory_adjustment", {
      p_product_id: productId,
      p_quantity_change: quantityChange,
      p_reason: reason,
      p_note: note,
      p_performed_by: auth.context.profile.displayName,
    });
    if (error) {
      // 早期資料庫尚未安裝 RPC 時，仍可安全地完成單筆調整。
      // 正常情況優先使用 RPC，以保有資料庫端的原子性保護。
      const missingFunction = error.code === "PGRST202" || /apply_inventory_adjustment/i.test(error.message) && /(function|schema cache|could not find)/i.test(error.message);
      if (!missingFunction) throw error;

      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, available_stock")
        .eq("id", productId)
        .maybeSingle();
      if (productError) throw productError;
      if (!product) return NextResponse.json({ message: "找不到選擇的商品。" }, { status: 404 });
      if (product.available_stock + quantityChange < 0) {
        return NextResponse.json({ message: "扣除數量不可超過目前可售庫存。" }, { status: 400 });
      }
      const { error: updateError } = await supabase
        .from("products")
        .update({ available_stock: product.available_stock + quantityChange, updated_at: new Date().toISOString() })
        .eq("id", productId);
      if (updateError) throw updateError;
      const { data: adjustment, error: adjustmentError } = await supabase
        .from("inventory_adjustments")
        .insert({ product_id: productId, quantity_change: quantityChange, reason, note, performed_by: auth.context.profile.displayName })
        .select("id, product_id, quantity_change, reason, note, performed_by, created_at")
        .single();
      if (adjustmentError) throw adjustmentError;
      return withRefreshedSession(NextResponse.json({ adjustment }, { status: 201 }), auth.context);
    }
    const result = Array.isArray(data) ? data[0] : data;
    return withRefreshedSession(NextResponse.json({ adjustment: result }, { status: 201 }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法儲存庫存調整。" }, { status: 500 });
  }
}
