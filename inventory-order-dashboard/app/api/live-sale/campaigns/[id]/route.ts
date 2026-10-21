import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
type ClaimStatus = "待核對" | "待結帳" | "已結帳" | "已轉訂單" | "已取消";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const campaignStatuses = ["進行中", "已結單", "已封存"];
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const nonNegativeInteger = (value: unknown) => value === null || value === "" || value === undefined ? null : (Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : undefined);
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

function buildCampaignDetail(campaign: Record<string, unknown>, claims: Array<Record<string, unknown>>, items: Array<Record<string, unknown>>, allocations: Array<Record<string, unknown>>, products: Array<Record<string, unknown>>) {
  const itemsByClaim = new Map<string, Array<Record<string, unknown>>>();
  for (const item of items) {
    const claimItems = itemsByClaim.get(item.claim_id as string) ?? [];
    claimItems.push(item);
    itemsByClaim.set(item.claim_id as string, claimItems);
  }
  const productById = new Map(products.map((product) => [product.id as string, product]));
  const allocationByProduct = new Map(allocations.map((allocation) => [allocation.product_id as string, allocation]));
  const hydratedClaims: Array<Record<string, unknown> & { items: Array<Record<string, unknown>> }> = claims.map((claim) => ({ ...claim, items: itemsByClaim.get(claim.id as string) ?? [] }));

  const summary = { claimCount: 0, activeAmount: 0, paidAmount: 0, pendingAmount: 0, unresolvedCount: 0 };
  const procurementLines = new Map<string, {
    productId: string | null;
    productName: string;
    specification: string;
    category: string;
    demandQuantity: number;
    paidQuantity: number;
    unresolvedQuantity: number;
    sourceClaims: Array<{ claimId: string; claimNumber: string; customerName: string; communityName: string; quantity: number; createdAt: string }>;
  }>();

  for (const claim of hydratedClaims) {
    const status = claim.status as ClaimStatus;
    const amount = Number(claim.claim_total) || 0;
    summary.claimCount += 1;
    if (status !== "已取消") summary.activeAmount += amount;
    if (status === "已結帳" || status === "已轉訂單") summary.paidAmount += amount;
    if (status === "待結帳") summary.pendingAmount += amount;
    if (status === "待核對") summary.unresolvedCount += 1;
    if (status === "已取消") continue;

    for (const item of claim.items as Array<Record<string, unknown>>) {
      const productId = typeof item.product_id === "string" && item.product_id ? item.product_id : null;
      const key = productId ?? `unresolved:${String(item.product_name)}:${String(item.specification)}`;
      const current = procurementLines.get(key) ?? {
        productId,
        productName: String(item.product_name || "待確認商品"),
        specification: String(item.specification || ""),
        category: String(item.category || ""),
        demandQuantity: 0,
        paidQuantity: 0,
        unresolvedQuantity: 0,
        sourceClaims: [],
      };
      const quantity = Number(item.quantity) || 0;
      current.demandQuantity += quantity;
      if (status === "已結帳" || status === "已轉訂單") current.paidQuantity += quantity;
      if (!productId || status === "待核對") current.unresolvedQuantity += quantity;
      current.sourceClaims.push({
        claimId: String(claim.id),
        claimNumber: String(claim.claim_number),
        customerName: String(claim.customer_name || claim.community_name || "未配對客戶"),
        communityName: String(claim.community_name || ""),
        quantity,
        createdAt: String(claim.created_at),
      });
      procurementLines.set(key, current);
    }
  }

  const procurement = [...procurementLines.values()].map((line) => {
    const allocation = line.productId ? allocationByProduct.get(line.productId) : undefined;
    const availableQuantity = allocation && allocation.available_quantity !== null && allocation.available_quantity !== undefined ? Number(allocation.available_quantity) : null;
    let remaining = availableQuantity ?? 0;
    const affectedCustomers: Array<{ claimId: string; claimNumber: string; customerName: string; communityName: string; quantity: number }> = [];
    if (availableQuantity !== null) {
      for (const source of [...line.sourceClaims].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
        const unavailable = Math.max(0, source.quantity - Math.max(0, remaining));
        remaining -= source.quantity;
        if (unavailable) affectedCustomers.push({ ...source, quantity: unavailable });
      }
    }
    const product = line.productId ? productById.get(line.productId) : undefined;
    return {
      ...line,
      productName: product?.name ? String(product.name) : line.productName,
      specification: product?.specification ? String(product.specification) : line.specification,
      category: product?.category ? String(product.category) : line.category,
      availableQuantity,
      availabilityNote: String(allocation?.note ?? ""),
      shortageQuantity: availableQuantity === null ? null : Math.max(0, line.demandQuantity - availableQuantity),
      affectedCustomers,
    };
  }).sort((a, b) => b.demandQuantity - a.demandQuantity || a.productName.localeCompare(b.productName, "zh-Hant"));

  return { campaign, claims: hydratedClaims, summary, procurement };
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "連線檔期資料不正確。" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data: campaign, error: campaignError } = await supabase
      .from("live_sale_campaigns")
      .select("id, name, campaign_code, status, start_date, end_date, note, created_by, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) return NextResponse.json({ message: "找不到連線檔期。" }, { status: 404 });

    const [{ data: claims, error: claimError }, { data: allocations, error: allocationError }] = await Promise.all([
      supabase.from("live_sale_claims").select("id, campaign_id, claim_number, customer_id, customer_name, line_name, community_name, source_inbox_id, status, claim_total, note, payment_marked_at, payment_marked_by, converted_order_id, created_at, updated_at, customers(id, name, line_name)").eq("campaign_id", id).order("created_at", { ascending: false }),
      supabase.from("live_sale_campaign_products").select("product_id, available_quantity, note, updated_at").eq("campaign_id", id),
    ]);
    if (claimError) throw claimError;
    if (allocationError) throw allocationError;
    const claimIds = (claims ?? []).map((claim) => claim.id);
    const { data: items, error: itemError } = claimIds.length
      ? await supabase.from("live_sale_claim_items").select("id, claim_id, product_id, product_name, category, specification, unit_price, quantity, created_at").in("claim_id", claimIds)
      : { data: [], error: null };
    if (itemError) throw itemError;
    const productIds = [...new Set([...(items ?? []).map((item) => item.product_id), ...(allocations ?? []).map((allocation) => allocation.product_id)].filter((productId): productId is string => typeof productId === "string" && productId.length > 0))];
    const { data: products, error: productError } = productIds.length
      ? await supabase.from("products").select("id, name, category, specification, available_stock").in("id", productIds)
      : { data: [], error: null };
    if (productError) throw productError;
    return withRefreshedSession(NextResponse.json(buildCampaignDetail(campaign, claims ?? [], items ?? [], allocations ?? [], products ?? [])), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法讀取連線檔期內容。") }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "連線檔期資料不正確。" }, { status: 400 });
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action);
    const supabase = getSupabaseAdmin();

    if (action === "updateSupply") {
      const productId = text(body.productId);
      const availableQuantity = nonNegativeInteger(body.availableQuantity);
      const note = text(body.note);
      if (!uuidPattern.test(productId) || availableQuantity === undefined) return NextResponse.json({ message: "可供應數量資料不正確。" }, { status: 400 });
      const { data, error } = await supabase
        .from("live_sale_campaign_products")
        .upsert({ campaign_id: id, product_id: productId, available_quantity: availableQuantity, note, updated_by: auth.context.profile.displayName, updated_at: new Date().toISOString() }, { onConflict: "campaign_id,product_id" })
        .select("product_id, available_quantity, note, updated_at")
        .single();
      if (error) throw error;
      return withRefreshedSession(NextResponse.json({ allocation: data }), auth.context);
    }

    if (action === "updateCampaign") {
      const status = text(body.status);
      const note = text(body.note);
      const endDate = text(body.endDate);
      if (!campaignStatuses.includes(status)) return NextResponse.json({ message: "檔期狀態不正確。" }, { status: 400 });
      if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return NextResponse.json({ message: "結束日期格式不正確。" }, { status: 400 });
      const { data, error } = await supabase.from("live_sale_campaigns").update({ status, note, end_date: endDate || null, updated_at: new Date().toISOString() }).eq("id", id).select("id, name, campaign_code, status, start_date, end_date, note, created_by, created_at, updated_at").single();
      if (error) throw error;
      return withRefreshedSession(NextResponse.json({ campaign: data }), auth.context);
    }

    return NextResponse.json({ message: "不支援的連線檔期操作。" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法更新連線檔期。") }, { status: 500 });
  }
}
