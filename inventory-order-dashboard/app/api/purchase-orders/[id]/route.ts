import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const positiveInteger = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};
const purchaseSelect = "id, purchase_number, supplier_id, supplier_name, expected_arrival_date, payment_terms, status, total, received_at, created_at, updated_at, purchase_order_items(id, product_id, product_name, unit_cost, quantity, received_quantity)";

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const body = await request.json();
    if (body.action !== "receive") return NextResponse.json({ message: "不支援的採購單操作。" }, { status: 400 });
    const { id } = await params;
    if (!uuidPattern.test(id) || !Array.isArray(body.items)) return NextResponse.json({ message: "收貨資料不正確。" }, { status: 400 });

    const items: Array<{ item_id: string; quantity: number | null }> = (body.items as Array<{ itemId?: unknown; quantity?: unknown }>).map((item) => ({
      item_id: typeof item.itemId === "string" ? item.itemId : "",
      quantity: positiveInteger(item.quantity),
    }));
    if (!items.length || items.some((item) => !uuidPattern.test(item.item_id) || item.quantity === null)) return NextResponse.json({ message: "請填寫正確的收貨數量。" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { error: receiptError } = await supabase.rpc("receive_purchase_order", {
      p_purchase_order_id: id,
      p_items: items,
      p_performed_by: auth.context.profile.displayName,
    });
    if (receiptError) throw receiptError;

    const { data, error } = await supabase.from("purchase_orders").select(purchaseSelect).eq("id", id).single();
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ purchaseOrder: data }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法完成收貨。" }, { status: 500 });
  }
}
