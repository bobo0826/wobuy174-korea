import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const orderStatuses = ["未通知", "已通知", "已出貨"];

const orderSelect = "id, order_number, order_date, status, payment_method, reconciliation_status, delivery_method, total, created_at, customers(id, name, line_name), order_items(id, product_name, quantity)";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function text(value: string | null) {
  return value?.trim() ?? "";
}

function matchesSearch(
  row: {
    claim_number: string;
    customer_name: string;
    line_name: string;
    campaign: { name: string; campaign_code: string } | null;
    order: { order_number: string; order_items: Array<{ product_name: string }> };
  },
  query: string,
) {
  if (!query) return true;
  const haystack = [
    row.claim_number,
    row.customer_name,
    row.line_name,
    row.campaign?.name,
    row.campaign?.campaign_code,
    row.order.order_number,
    ...row.order.order_items.map((item) => item.product_name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-Hant");
  return haystack.includes(query.toLocaleLowerCase("zh-Hant"));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;

    const url = new URL(request.url);
    const startDate = text(url.searchParams.get("startDate"));
    const endDate = text(url.searchParams.get("endDate"));
    const query = text(url.searchParams.get("query"));
    const status = text(url.searchParams.get("status"));
    const requestedPage = Number(url.searchParams.get("page") ?? "1");
    const requestedPageSize = Number(url.searchParams.get("pageSize") ?? "50");
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0 ? Math.min(requestedPageSize, 100) : 50;

    if ((startDate && !datePattern.test(startDate)) || (endDate && !datePattern.test(endDate))) {
      return NextResponse.json({ message: "日期格式不正確。" }, { status: 400 });
    }
    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json({ message: "結束日期不可早於起始日期。" }, { status: 400 });
    }
    if (status && !orderStatuses.includes(status)) {
      return NextResponse.json({ message: "已結單訂單狀況不正確。" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: claims, error: claimsError } = await supabase
      .from("live_sale_claims")
      .select("id, campaign_id, claim_number, customer_name, line_name, notification_status, claim_total, converted_order_id, created_at, updated_at")
      .eq("status", "已轉訂單")
      .not("converted_order_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(2000);
    if (claimsError) throw claimsError;

    const orderIds = [...new Set((claims ?? [])
      .map((claim) => claim.converted_order_id)
      .filter((id): id is string => typeof id === "string" && uuidPattern.test(id)))];
    const campaignIds = [...new Set((claims ?? [])
      .map((claim) => claim.campaign_id)
      .filter((id): id is string => typeof id === "string" && uuidPattern.test(id)))];

    const [ordersResult, campaignsResult] = await Promise.all([
      orderIds.length
        ? supabase.from("orders").select(orderSelect).in("id", orderIds)
        : Promise.resolve({ data: [], error: null }),
      campaignIds.length
        ? supabase.from("live_sale_campaigns").select("id, name, campaign_code").in("id", campaignIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (ordersResult.error) throw ordersResult.error;
    if (campaignsResult.error) throw campaignsResult.error;

    const ordersById = new Map((ordersResult.data ?? []).map((order) => [order.id, order]));
    const campaignsById = new Map((campaignsResult.data ?? []).map((campaign) => [campaign.id, campaign]));
    const rows = (claims ?? [])
      .map((claim) => {
        const order = typeof claim.converted_order_id === "string" ? ordersById.get(claim.converted_order_id) : undefined;
        if (!order) return null;
        const campaign = campaignsById.get(claim.campaign_id);
        const derivedStatus = order.status === "已出貨" ? "已出貨" : claim.notification_status || "未通知";
        return {
          id: claim.id,
          claim_number: claim.claim_number,
          customer_name: claim.customer_name,
          line_name: claim.line_name,
          notification_status: claim.notification_status || "未通知",
          claim_total: Number(claim.claim_total) || 0,
          created_at: claim.created_at,
          campaign: campaign ? { name: campaign.name, campaign_code: campaign.campaign_code } : null,
          order: {
            ...order,
            total: Number(order.total) || 0,
            order_items: order.order_items ?? [],
          },
          display_status: derivedStatus,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => (!startDate || row.order.order_date >= startDate) && (!endDate || row.order.order_date <= endDate))
      .filter((row) => !status || row.display_status === status)
      .filter((row) => matchesSearch(row, query))
      .sort((left, right) => right.order.order_date.localeCompare(left.order.order_date) || right.created_at.localeCompare(left.created_at));

    const total = rows.length;
    const offset = (page - 1) * pageSize;
    const orders = rows.slice(offset, offset + pageSize);
    return withRefreshedSession(NextResponse.json({
      orders,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法讀取已結單訂單。") }, { status: 503 });
  }
}
