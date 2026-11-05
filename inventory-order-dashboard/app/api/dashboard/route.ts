import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type DashboardMetrics = {
  preorders: number;
  low_stock: number;
  pending_purchases: number;
  monthly_sales: number;
  shipped_orders: number;
  order_count: number;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;

    const { data, error } = await getSupabaseAdmin()
      .rpc("get_dashboard_summary")
      .single();
    if (error) throw error;
    const metrics = data as DashboardMetrics | null;

    const summary = {
      preorders: Number(metrics?.preorders ?? 0),
      lowStock: Number(metrics?.low_stock ?? 0),
      pendingPurchases: Number(metrics?.pending_purchases ?? 0),
      monthlySales: Number(metrics?.monthly_sales ?? 0),
      shippedOrders: Number(metrics?.shipped_orders ?? 0),
      orderCount: Number(metrics?.order_count ?? 0),
    };

    return withRefreshedSession(NextResponse.json({ summary }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法讀取營運摘要。" }, { status: 503 });
  }
}
