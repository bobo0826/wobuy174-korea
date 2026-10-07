import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dayMs = 24 * 60 * 60 * 1000;

function daysBetween(start: string, end: string) {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / dayMs);
}

function dateRange(start: string, end: string) {
  const rows: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  while (cursor.getTime() <= last) {
    rows.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return rows;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;

    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate") ?? "";
    const endDate = url.searchParams.get("endDate") ?? "";
    if (!datePattern.test(startDate) || !datePattern.test(endDate)) return NextResponse.json({ message: "請選擇完整的查詢日期區間。" }, { status: 400 });
    const periodLength = daysBetween(startDate, endDate);
    if (periodLength < 0) return NextResponse.json({ message: "結束日期不可早於開始日期。" }, { status: 400 });
    if (periodLength > 731) return NextResponse.json({ message: "查詢區間最多為兩年。" }, { status: 400 });

    const { data, error } = await getSupabaseAdmin()
      .from("orders")
      .select("order_date, total, net_profit")
      .gte("order_date", startDate)
      .lte("order_date", endDate)
      .neq("status", "已取消");
    if (error) throw error;

    const grouped = new Map<string, { revenue: number; netProfit: number; orderCount: number }>();
    for (const order of data ?? []) {
      const date = order.order_date;
      if (!date) continue;
      const current = grouped.get(date) ?? { revenue: 0, netProfit: 0, orderCount: 0 };
      current.revenue += Number(order.total) || 0;
      current.netProfit += Number(order.net_profit) || 0;
      current.orderCount += 1;
      grouped.set(date, current);
    }

    const rows = dateRange(startDate, endDate).reverse().map((date) => ({ date, ...(grouped.get(date) ?? { revenue: 0, netProfit: 0, orderCount: 0 }) }));
    const summary = rows.reduce((totals, row) => ({ revenue: totals.revenue + row.revenue, netProfit: totals.netProfit + row.netProfit, orderCount: totals.orderCount + row.orderCount }), { revenue: 0, netProfit: 0, orderCount: 0 });
    return withRefreshedSession(NextResponse.json({ startDate, endDate, summary, rows }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法讀取營運報表。" }, { status: 503 });
  }
}
