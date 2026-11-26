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
    created_at: string;
    status: string;
    customers: { name: string } | { name: string }[] | null;
  } | {
    id: string;
    order_number: string;
    order_date: string;
    created_at: string;
    status: string;
    customers: { name: string } | { name: string }[] | null;
  }[] | null;
};

type RelatedClaimItemRow = {
  id: string;
  quantity: number;
  product_id: string | null;
  live_sale_product_id: string | null;
  live_sale_claims: {
    id: string;
    claim_number: string;
    customer_name: string;
    status: string;
    created_at: string;
    converted_order_id: string | null;
  } | {
    id: string;
    claim_number: string;
    customer_name: string;
    status: string;
    created_at: string;
    converted_order_id: string | null;
  }[] | null;
};

type PurchasedEntry = {
  id: string;
  order_id: string | null;
  order_number: string;
  order_date: string;
  ordered_at: string;
  status: string;
  customer_name: string;
  quantity: number;
  source: "order" | "claim";
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;

    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "商品資料不正確。" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const [{ data, error }, { data: linkedLiveProducts, error: linkedLiveProductsError }] = await Promise.all([
      supabase
        .from("order_items")
        .select("id, order_id, quantity, created_at, orders!inner(id, order_number, order_date, created_at, status, customers(name))")
        .eq("product_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("live_sale_products")
        .select("id")
        .eq("promoted_product_id", id),
    ]);
    if (error) throw error;
    if (linkedLiveProductsError) throw linkedLiveProductsError;

    const orders: PurchasedEntry[] = (data as RelatedOrderRow[] ?? []).flatMap((item): PurchasedEntry[] => {
      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
      if (!order) return [];
      const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
      return [{
        id: `order:${order.id}`,
        order_id: order.id,
        order_number: order.order_number,
        order_date: order.order_date,
        ordered_at: order.created_at,
        status: order.status,
        customer_name: customer?.name ?? "未指定客戶",
        quantity: item.quantity,
        source: "order" as const,
      }];
    });

    const liveProductIds = (linkedLiveProducts ?? []).map((product) => product.id);
    const claimFilters = [`product_id.eq.${id}`, ...liveProductIds.map((liveProductId) => `live_sale_product_id.eq.${liveProductId}`)];
    const { data: claimItems, error: claimItemsError } = await supabase
      .from("live_sale_claim_items")
      .select("id, quantity, product_id, live_sale_product_id, live_sale_claims!inner(id, claim_number, customer_name, status, created_at, converted_order_id)")
      .or(claimFilters.join(","))
      .order("created_at", { ascending: true });
    if (claimItemsError) throw claimItemsError;

    const claimOrders = (claimItems as RelatedClaimItemRow[] ?? []).flatMap((item) => {
      const claim = Array.isArray(item.live_sale_claims) ? item.live_sale_claims[0] : item.live_sale_claims;
      // 已轉為一般訂單的喊單會由 order_items 顯示，避免同一筆購買出現兩次。
      if (!claim || claim.converted_order_id) return [];
      return [{
        id: `claim:${claim.id}:${item.id}`,
        order_id: null,
        order_number: claim.claim_number,
        order_date: claim.created_at.slice(0, 10),
        ordered_at: claim.created_at,
        status: claim.status,
        customer_name: claim.customer_name || "未指定客戶",
        quantity: item.quantity,
        source: "claim" as const,
      }];
    });

    orders.push(...claimOrders);

    orders.sort((left, right) => new Date(left.ordered_at).getTime() - new Date(right.ordered_at).getTime());

    return withRefreshedSession(NextResponse.json({ orders }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法讀取商品訂單。" }, { status: 503 });
  }
}
