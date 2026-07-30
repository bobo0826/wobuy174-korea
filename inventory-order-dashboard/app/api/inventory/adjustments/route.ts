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

    const { data, error } = await getSupabaseAdmin().rpc("apply_inventory_adjustment", {
      p_product_id: productId,
      p_quantity_change: quantityChange,
      p_reason: reason,
      p_note: note,
      p_performed_by: auth.context.profile.displayName,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    return withRefreshedSession(NextResponse.json({ adjustment: result }, { status: 201 }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法儲存庫存調整。" }, { status: 500 });
  }
}
