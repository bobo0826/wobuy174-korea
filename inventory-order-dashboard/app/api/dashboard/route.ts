import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function taipeiMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;

    const supabase = getSupabaseAdmin();
    const [{ data: orders, error: ordersError }, { data: products, error: productsError }, { data: purchases, error: purchasesError }] = await Promise.all([
      supabase.from("orders").select("order_date, status, total"),
      supabase.from("products").select("available_stock, safety_stock"),
      supabase.from("purchase_orders").select("status"),
    ]);
    if (ordersError) throw ordersError;
    if (productsError) throw productsError;
    if (purchasesError) throw purchasesError;

    const month = taipeiMonth();
    const summary = {
      preorders: (orders ?? []).filter((order) => order.status === "預購中").length,
      lowStock: (products ?? []).filter((product) => Number(product.available_stock) <= Number(product.safety_stock)).length,
      pendingPurchases: (purchases ?? []).filter((purchase) => purchase.status !== "已完成" && purchase.status !== "已取消").length,
      monthlySales: (orders ?? []).filter((order) => order.order_date?.startsWith(month) && order.status !== "已取消").reduce((sum, order) => sum + (Number(order.total) || 0), 0),
      shippedOrders: (orders ?? []).filter((order) => order.status === "已出貨").length,
      orderCount: (orders ?? []).length,
    };

    return withRefreshedSession(NextResponse.json({ summary }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法讀取營運摘要。" }, { status: 503 });
  }
}
