import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const campaignStatuses = ["進行中", "已結單", "已封存"];

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

function taipeiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function normaliseCode(value: unknown) {
  return text(value).toUpperCase().replaceAll(/[^A-Z0-9-]/g, "");
}

function validateCampaign(input: Record<string, unknown>) {
  const name = text(input.name);
  const campaignCode = normaliseCode(input.campaignCode);
  const startDate = text(input.startDate) || taipeiToday();
  const endDate = text(input.endDate);
  const note = text(input.note);
  const status = text(input.status) || "進行中";

  if (!name || name.length > 80) return { error: "請輸入 1 至 80 字的連線檔期名稱。" };
  if (!/^[A-Z0-9-]{2,20}$/.test(campaignCode)) return { error: "檔期編號限 2 至 20 碼英文、數字或連字號。" };
  if (!datePattern.test(startDate) || (endDate && !datePattern.test(endDate))) return { error: "檔期日期格式不正確。" };
  if (endDate && endDate < startDate) return { error: "結束日期不可早於開始日期。" };
  if (!campaignStatuses.includes(status)) return { error: "檔期狀態不正確。" };
  return { payload: { name, campaign_code: campaignCode, start_date: startDate, end_date: endDate || null, note, status } };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const supabase = getSupabaseAdmin();
    const [{ data: campaigns, error: campaignError }, { data: claims, error: claimError }] = await Promise.all([
      supabase.from("live_sale_campaigns").select("id, name, campaign_code, status, start_date, end_date, note, created_by, created_at, updated_at").order("start_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("live_sale_claims").select("campaign_id, status, claim_total"),
    ]);
    if (campaignError) throw campaignError;
    if (claimError) throw claimError;

    const summaryByCampaign = new Map<string, { claimCount: number; activeAmount: number; paidAmount: number; pendingAmount: number; unresolvedCount: number }>();
    for (const claim of claims ?? []) {
      const summary = summaryByCampaign.get(claim.campaign_id) ?? { claimCount: 0, activeAmount: 0, paidAmount: 0, pendingAmount: 0, unresolvedCount: 0 };
      const amount = Number(claim.claim_total) || 0;
      summary.claimCount += 1;
      if (claim.status !== "已取消") summary.activeAmount += amount;
      if (claim.status === "已結帳" || claim.status === "已轉訂單") summary.paidAmount += amount;
      if (claim.status === "待結帳") summary.pendingAmount += amount;
      if (claim.status === "待核對") summary.unresolvedCount += 1;
      summaryByCampaign.set(claim.campaign_id, summary);
    }

    return withRefreshedSession(NextResponse.json({ campaigns: (campaigns ?? []).map((campaign) => ({ ...campaign, summary: summaryByCampaign.get(campaign.id) ?? { claimCount: 0, activeAmount: 0, paidAmount: 0, pendingAmount: 0, unresolvedCount: 0 } })) }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法讀取連線檔期。") }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const validation = validateCampaign(await request.json() as Record<string, unknown>);
    if ("error" in validation) return NextResponse.json(validation, { status: 400 });
    const { data, error } = await getSupabaseAdmin()
      .from("live_sale_campaigns")
      .insert({ ...validation.payload, created_by: auth.context.profile.displayName })
      .select("id, name, campaign_code, status, start_date, end_date, note, created_by, created_at, updated_at")
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ message: "此檔期編號已存在，請改用其他編號。" }, { status: 409 });
      throw error;
    }
    return withRefreshedSession(NextResponse.json({ campaign: { ...data, summary: { claimCount: 0, activeAmount: 0, paidAmount: 0, pendingAmount: 0, unresolvedCount: 0 } } }, { status: 201 }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法建立連線檔期。") }, { status: 500 });
  }
}
