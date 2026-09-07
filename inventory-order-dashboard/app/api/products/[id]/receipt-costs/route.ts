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
      .select("id, unit_cost, local_unit_cost, quantity, received_quantity, created_at, purchase_orders(purchase_number, order_date, arrival_date, currency_code)")
      .eq("product_id", id)
      .gt("received_quantity", 0)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return withRefreshedSession(NextResponse.json({ receiptCosts: data ?? [] }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法讀取入庫成本。" }, { status: 503 });
  }
}
