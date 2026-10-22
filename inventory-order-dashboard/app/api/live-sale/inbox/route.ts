import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const params = new URL(request.url).searchParams;
    const requestedStatus = params.get("status") ?? "待處理";
    const campaignId = params.get("campaignId") ?? "";
    if (campaignId && !uuidPattern.test(campaignId)) return NextResponse.json({ message: "連線檔期資料不正確。" }, { status: 400 });
    const statuses = requestedStatus === "全部" ? ["待處理", "已建立喊單", "已略過"] : [requestedStatus];
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("live_sale_inbox")
      .select("id, line_message_id, line_user_id, message_text, campaign_id, parsed_items, customer_id, status, received_at, processed_at, created_at, customers(id, name, line_name)")
      .eq("source_type", "text")
      .in("status", statuses)
      .order("received_at", { ascending: false })
      .limit(40);
    if (campaignId) query = query.or(`campaign_id.eq.${campaignId},campaign_id.is.null`);
    const { data: inbox, error } = await query;
    if (error) throw error;
    const userIds = [...new Set((inbox ?? []).map((item) => item.line_user_id).filter(Boolean))];
    const { data: aliases, error: aliasError } = userIds.length
      ? await supabase.from("live_sale_customer_aliases").select("line_user_id, customer_id, customers(id, name, line_name)").eq("community_name", "LINE 私訊").in("line_user_id", userIds)
      : { data: [], error: null };
    if (aliasError) throw aliasError;
    const matchedCustomerByUser = new Map<string, { id: string; name: string; line_name: string }>();
    for (const alias of aliases ?? []) {
      const customer = alias.customers as unknown as { id: string; name: string; line_name: string } | null;
      if (customer && !matchedCustomerByUser.has(alias.line_user_id)) matchedCustomerByUser.set(alias.line_user_id, customer);
    }
    const records = (inbox ?? []).map((item) => {
      const customer = item.customers as unknown as { id: string; name: string; line_name: string } | null;
      return { ...item, matched_customer: customer ?? matchedCustomerByUser.get(item.line_user_id) ?? null };
    });
    return withRefreshedSession(NextResponse.json({ inbox: records }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法讀取 LINE 私訊收件匣。") }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const body = await request.json() as Record<string, unknown>;
    const id = text(body.id);
    const action = text(body.action);
    if (!uuidPattern.test(id) || !["dismiss", "restore"].includes(action)) return NextResponse.json({ message: "LINE 私訊操作資料不正確。" }, { status: 400 });
    const update = action === "dismiss" ? { status: "已略過", processed_at: new Date().toISOString() } : { status: "待處理", processed_at: null };
    const { data, error } = await getSupabaseAdmin().from("live_sale_inbox").update(update).eq("id", id).select("id, status, processed_at").single();
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ inbox: data }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法更新 LINE 私訊狀態。") }, { status: 500 });
  }
}
