import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

type RelatedOrderRow = {
  id: string;
  order_id: string;
  quantity: number;
  orders: {
    id: string;
    order_number: string;
    order_date: string;
    status: string;
    customers: { name: string } | { name: string }[] | null;
  } | {
    id: string;
    order_number: string;
    order_date: string;
    status: string;
    customers: { name: string } | { name: string }[] | null;
  }[] | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;

    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "商品資料不正確。" }, { status: 400 });

    const { data, error } = await getSupabaseAdmin()
      .from("order_items")
      .select("id, order_id, quantity, orders!inner(id, order_number, order_date, status, customers(name))")
      .eq("product_id", id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const orders = (data as RelatedOrderRow[] ?? []).flatMap((item) => {
      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
      if (!order) return [];
      const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
      return [{
        id: order.id,
        order_number: order.order_number,
        order_date: order.order_date,
        status: order.status,
        customer_name: customer?.name ?? "未指定客戶",
        quantity: item.quantity,
      }];
    });

    return withRefreshedSession(NextResponse.json({ orders }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法讀取商品訂單。" }, { status: 503 });
  }
}
