import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "商品資料不正確。" }, { status: 400 });

    const { data, error } = await getSupabaseAdmin()
      .from("purchase_order_items")
      .select("id, unit_cost, local_unit_cost, received_quantity, purchase_orders(purchase_number, order_date, currency_code)")
      .eq("product_id", id)
      .gt("received_quantity", 0);
    if (error) throw error;

    const receiptCosts = (data ?? []).map((entry) => ({
      ...entry,
      purchase_orders: Array.isArray(entry.purchase_orders) ? entry.purchase_orders[0] ?? null : entry.purchase_orders,
    })).sort((left, right) => {
      const leftDate = left.purchase_orders?.order_date ?? "";
      const rightDate = right.purchase_orders?.order_date ?? "";
      return rightDate.localeCompare(leftDate);
    });
    return withRefreshedSession(NextResponse.json({ receiptCosts }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法讀取入庫成本。" }, { status: 503 });
  }
}
