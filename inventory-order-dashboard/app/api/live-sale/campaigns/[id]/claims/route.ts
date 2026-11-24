import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { promoteLiveSaleProduct } from "@/lib/live-sale-products";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
type ItemInput = { productId?: unknown; liveSaleProductId?: unknown; productName?: unknown; specification?: unknown; unitPrice?: unknown; quantity?: unknown };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const integer = (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

async function nextClaimNumber(campaignId: string, campaignCode: string) {
  const prefix = `LS-${campaignCode}-`;
  const { data, error } = await getSupabaseAdmin().from("live_sale_claims").select("claim_number").eq("campaign_id", campaignId).like("claim_number", `${prefix}%`);
  if (error) throw error;
  const sequence = (data ?? []).reduce((highest, claim) => {
    const value = typeof claim.claim_number === "string" ? claim.claim_number : "";
    const number = Number(value.slice(prefix.length));
    return Number.isInteger(number) ? Math.max(highest, number) : highest;
  }, 0);
  return `${prefix}${String(sequence + 1).padStart(3, "0")}`;
}

async function resolveItems(rawItems: unknown, campaign: { id: string; campaign_code: string }) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw new Error("請至少加入一項喊單商品。");
  const inputs = rawItems as ItemInput[];
  const productIds = [...new Set(inputs.map((item) => text(item.productId)).filter((id) => id && uuidPattern.test(id)))];
  const liveSaleProductIds = [...new Set(inputs.map((item) => text(item.liveSaleProductId)).filter((id) => id && uuidPattern.test(id)))];
  const supabase = getSupabaseAdmin();
  const { data: products, error: productError } = productIds.length
    ? await supabase.from("products").select("id, name, category, specification, retail_price").in("id", productIds)
    : { data: [], error: null };
  if (productError) throw productError;
  const byId = new Map((products ?? []).map((product) => [product.id, product]));
  const promotedByLiveId = new Map<string, Awaited<ReturnType<typeof promoteLiveSaleProduct>>["product"]>();
  for (const liveSaleProductId of liveSaleProductIds) {
    const promoted = await promoteLiveSaleProduct(campaign, liveSaleProductId);
    promotedByLiveId.set(liveSaleProductId, promoted.product);
  }

  const items = inputs.map((input) => {
    const productId = text(input.productId);
    const liveSaleProductId = text(input.liveSaleProductId);
    const product = liveSaleProductId ? promotedByLiveId.get(liveSaleProductId) : productId ? byId.get(productId) : undefined;
    if (productId && !product) throw new Error("選擇的商品已不存在，請重新選擇。 ");
    if (liveSaleProductId && !product) throw new Error("選擇的檔期商品已不存在，請重新選擇。 ");
    const productName = product?.name ?? text(input.productName);
    const unitPrice = integer(input.unitPrice);
    const quantity = integer(input.quantity);
    if (!productName || !quantity || quantity < 1) throw new Error("喊單商品名稱與數量不可空白。 ");
    const price = unitPrice ?? (product ? Number(product.retail_price) : null);
    if (price === null) throw new Error("請填寫手動帶入商品的售價。 ");
    return {
      product_id: product?.id ?? null,
      live_sale_product_id: liveSaleProductId || null,
      product_name: productName,
      category: product?.category ?? "",
      specification: text(input.specification) || product?.specification || "",
      unit_price: price,
      quantity,
    };
  });
  return items;
}

function mergeLineNames(current: string, incoming: string) {
  const cleanCurrent = current.trim();
  const cleanIncoming = incoming.trim();
  if (!cleanIncoming || cleanCurrent.includes(cleanIncoming)) return cleanCurrent;
  return cleanCurrent ? `${cleanCurrent} ／ ${cleanIncoming}`.slice(0, 160) : cleanIncoming.slice(0, 160);
}

async function rememberCustomerAlias({ sourceInboxId, customerId, communityName, currentLineName }: { sourceInboxId: string; customerId: string; communityName: string; currentLineName: string }) {
  const supabase = getSupabaseAdmin();
  const { data: inbox, error: inboxError } = await supabase.from("live_sale_inbox").select("id, line_user_id, line_display_name").eq("id", sourceInboxId).maybeSingle();
  if (inboxError) throw inboxError;
  if (!inbox) throw new Error("找不到選擇的 LINE 私訊。 ");
  const now = new Date().toISOString();
  const userId = inbox.line_user_id || "";
  if (userId) {
    const { data: existing, error: aliasLookupError } = await supabase.from("live_sale_customer_aliases").select("id").eq("line_user_id", userId).eq("community_name", communityName).maybeSingle();
    if (aliasLookupError) throw aliasLookupError;
    const aliasResult = existing
      ? await supabase.from("live_sale_customer_aliases").update({ customer_id: customerId, updated_at: now }).eq("id", existing.id)
      : await supabase.from("live_sale_customer_aliases").insert({ customer_id: customerId, community_name: communityName, line_user_id: userId, updated_at: now });
    if (aliasResult.error) throw aliasResult.error;
  } else {
    const { error } = await supabase.from("live_sale_customer_aliases").upsert({ customer_id: customerId, community_name: communityName, line_user_id: "", updated_at: now }, { onConflict: "customer_id,community_name" });
    if (error) throw error;
  }
  const lineName = mergeLineNames(currentLineName, inbox.line_display_name ?? "");
  if (lineName !== currentLineName) {
    const { error } = await supabase
      .from("customers")
      .update({ line_name: lineName, updated_at: now })
      .eq("id", customerId);
    if (error) throw error;
  }
  return lineName;
}

type ResolvedItem = { product_id: string | null; live_sale_product_id: string | null; product_name: string; category: string; specification: string; unit_price: number; quantity: number };

async function lineUserIdForInbox(supabase: ReturnType<typeof getSupabaseAdmin>, inboxId: string) {
  if (!inboxId) return "";
  const { data, error } = await supabase.from("live_sale_inbox").select("line_user_id").eq("id", inboxId).maybeSingle();
  if (error) throw error;
  return typeof data?.line_user_id === "string" ? data.line_user_id.trim() : "";
}

function combineItems(items: ResolvedItem[]) {
  const combined = new Map<string, ResolvedItem>();
  for (const item of items) {
    const itemKey = `${item.product_id ?? item.live_sale_product_id ?? item.product_name}::${item.specification}::${item.unit_price}`;
    const current = combined.get(itemKey);
    combined.set(itemKey, current ? { ...current, quantity: current.quantity + item.quantity } : { ...item });
  }
  return [...combined.values()];
}

async function appendToOpenClaim({ campaignId, customer, items, note, sourceInboxId }: { campaignId: string; customer: { id: string; name: string; line_name: string }; items: ResolvedItem[]; note: string; sourceInboxId: string }) {
  const supabase = getSupabaseAdmin();
  const sourceLineUserId = await lineUserIdForInbox(supabase, sourceInboxId);
  if (!sourceLineUserId) return null;
  const { data: candidates, error: targetError } = await supabase
    .from("live_sale_claims")
    .select("id, claim_total, note, source_inbox_id")
    .eq("campaign_id", campaignId)
    .eq("customer_id", customer.id)
    .in("status", ["待核對", "待結帳"])
    .order("created_at", { ascending: true })
  if (targetError) throw targetError;
  const targetInboxIds = [...new Set((candidates ?? []).map((candidate) => candidate.source_inbox_id).filter(Boolean))] as string[];
  const { data: targetInboxes, error: inboxError } = targetInboxIds.length
    ? await supabase.from("live_sale_inbox").select("id, line_user_id").in("id", targetInboxIds)
    : { data: [], error: null };
  if (inboxError) throw inboxError;
  const userIdByInbox = new Map((targetInboxes ?? []).map((inbox) => [inbox.id, inbox.line_user_id]));
  const target = (candidates ?? []).find((candidate) => userIdByInbox.get(candidate.source_inbox_id ?? "") === sourceLineUserId);
  if (!target) return null;
  const { data: existingItems, error: existingItemsError } = await supabase
    .from("live_sale_claim_items")
    .select("product_id, live_sale_product_id, product_name, category, specification, unit_price, quantity")
    .eq("claim_id", target.id);
  if (existingItemsError) throw existingItemsError;
  const mergedItems = combineItems([...(existingItems ?? []), ...items] as ResolvedItem[]);
  const total = mergedItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const nextNote = note && !target.note.includes(note) ? [target.note, note].filter(Boolean).join("\n") : target.note;
  const { error: headerError } = await supabase.from("live_sale_claims").update({ claim_total: total, note: nextNote, updated_at: new Date().toISOString() }).eq("id", target.id);
  if (headerError) throw headerError;
  const { error: deleteError } = await supabase.from("live_sale_claim_items").delete().eq("claim_id", target.id);
  if (deleteError) throw deleteError;
  const { error: insertError } = await supabase.from("live_sale_claim_items").insert(mergedItems.map((item) => ({ claim_id: target.id, ...item })));
  if (insertError) throw insertError;
  return target.id as string;
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id: campaignId } = await params;
    if (!uuidPattern.test(campaignId)) return NextResponse.json({ message: "連線檔期資料不正確。" }, { status: 400 });
    const body = await request.json() as Record<string, unknown>;
    const communityName = text(body.communityName);
    const customerId = text(body.customerId);
    const sourceInboxId = text(body.sourceInboxId);
    const note = text(body.note);
    if (!communityName || communityName.length > 80) return NextResponse.json({ message: "請填寫喊單來源。" }, { status: 400 });
    if (customerId && !uuidPattern.test(customerId)) return NextResponse.json({ message: "選擇的客戶資料不正確。" }, { status: 400 });
    if (sourceInboxId && !uuidPattern.test(sourceInboxId)) return NextResponse.json({ message: "LINE 私訊資料不正確。" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: campaign, error: campaignError } = await supabase
      .from("live_sale_campaigns")
      .select("id, campaign_code, status")
      .eq("id", campaignId)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) return NextResponse.json({ message: "找不到連線檔期。" }, { status: 404 });
    if (campaign.status === "已封存") return NextResponse.json({ message: "已封存檔期不可新增喊單。" }, { status: 409 });
    const items = await resolveItems(body.items, campaign);

    const { data: selectedCustomer, error: customerError } = customerId
      ? await supabase.from("customers").select("id, name, line_name").eq("id", customerId).maybeSingle()
      : { data: null, error: null };
    if (customerError) throw customerError;
    if (customerId && !selectedCustomer) return NextResponse.json({ message: "找不到選擇的客戶。" }, { status: 400 });
    let customer = selectedCustomer;
    if (customer && sourceInboxId) {
      const lineName = await rememberCustomerAlias({ sourceInboxId, customerId: customer.id, communityName, currentLineName: customer.line_name ?? "" });
      customer = { ...customer, line_name: lineName };
    }
    const total = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const resolved = Boolean(customer) && items.every((item) => Boolean(item.product_id));
    const status = resolved ? "待結帳" : "待核對";
    let createdId = "";

    // 同檔期、同客戶且尚未結帳的喊單會自動合併。未辨識客戶或商品的訊息
    // 仍保留為待核對，待人員完成配對後才會在修改流程中合併。
    if (customer && resolved && sourceInboxId) createdId = await appendToOpenClaim({ campaignId, customer, items, note, sourceInboxId }) ?? "";

    for (let attempt = 0; !createdId && attempt < 3; attempt += 1) {
      const claimNumber = await nextClaimNumber(campaignId, campaign.campaign_code);
      const { data: claim, error: claimError } = await supabase
        .from("live_sale_claims")
        .insert({
          campaign_id: campaignId,
          claim_number: claimNumber,
          customer_id: customer?.id ?? null,
          customer_name: customer?.name ?? "",
          line_name: customer?.line_name ?? "",
          community_name: communityName,
          source_inbox_id: sourceInboxId || null,
          status,
          claim_total: total,
          note,
        })
        .select("id, claim_number, status, claim_total")
        .single();
      if (claimError) {
        if (claimError.code === "23505" && attempt < 2) continue;
        if (claimError.code === "23505" && sourceInboxId) return NextResponse.json({ message: "這則 LINE 私訊已建立過喊單。" }, { status: 409 });
        throw claimError;
      }
      createdId = claim.id;
      const { error: itemError } = await supabase.from("live_sale_claim_items").insert(items.map((item) => ({ claim_id: claim.id, ...item })));
      if (itemError) {
        await supabase.from("live_sale_claims").delete().eq("id", claim.id);
        throw itemError;
      }
      break;
    }
    if (!createdId) throw new Error("無法取得新的喊單編號，請再試一次。 ");

    if (sourceInboxId) {
      const { error: inboxError } = await supabase.from("live_sale_inbox").update({ campaign_id: campaignId, customer_id: customer?.id ?? null, status: "已建立喊單", processed_at: new Date().toISOString() }).eq("id", sourceInboxId);
      if (inboxError) throw inboxError;
    }
    const { data: created, error: createdError } = await supabase.from("live_sale_claims").select("id, campaign_id, claim_number, customer_id, customer_name, line_name, community_name, source_inbox_id, status, claim_total, note, payment_marked_at, payment_marked_by, converted_order_id, created_at, updated_at").eq("id", createdId).single();
    if (createdError) throw createdError;
    return withRefreshedSession(NextResponse.json({ claim: { ...created, items } }, { status: 201 }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法建立連線喊單。") }, { status: 500 });
  }
}
