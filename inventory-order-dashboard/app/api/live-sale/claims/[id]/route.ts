import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
type ItemInput = { productId?: unknown; productName?: unknown; specification?: unknown; unitPrice?: unknown; quantity?: unknown };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const integer = (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

function taipeiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

async function resolveItems(rawItems: unknown) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw new Error("請至少加入一項喊單商品。 ");
  const inputs = rawItems as ItemInput[];
  const ids = [...new Set(inputs.map((item) => text(item.productId)).filter((id) => id && uuidPattern.test(id)))];
  const supabase = getSupabaseAdmin();
  const { data: products, error } = ids.length ? await supabase.from("products").select("id, name, category, specification, retail_price").in("id", ids) : { data: [], error: null };
  if (error) throw error;
  const byId = new Map((products ?? []).map((product) => [product.id, product]));
  return inputs.map((input) => {
    const productId = text(input.productId);
    const product = productId ? byId.get(productId) : undefined;
    if (productId && !product) throw new Error("選擇的商品已不存在，請重新選擇。 ");
    const quantity = integer(input.quantity);
    const price = integer(input.unitPrice) ?? (product ? Number(product.retail_price) : null);
    const productName = product?.name ?? text(input.productName);
    if (!productName || !quantity || quantity < 1 || price === null) throw new Error("喊單商品的名稱、售價與數量不可空白。 ");
    return { product_id: product?.id ?? null, product_name: productName, category: product?.category ?? "", specification: text(input.specification) || product?.specification || "", unit_price: price, quantity };
  });
}

async function nextOrderNumber(orderDate: string) {
  const prefix = orderDate.replaceAll("-", "");
  const { data, error } = await getSupabaseAdmin().from("orders").select("order_number").like("order_number", `${prefix}%`);
  if (error) throw error;
  const sequence = (data ?? []).reduce((highest, order) => {
    const number = typeof order.order_number === "string" ? order.order_number : "";
    if (!new RegExp(`^${prefix}\\d{3,}$`).test(number)) return highest;
    return Math.max(highest, Number(number.slice(prefix.length)) || 0);
  }, 0);
  return `${prefix}${String(sequence + 1).padStart(3, "0")}`;
}

async function fetchClaim(id: string) {
  const { data, error } = await getSupabaseAdmin().from("live_sale_claims").select("id, campaign_id, claim_number, customer_id, customer_name, line_name, community_name, source_inbox_id, status, notification_status, claim_total, note, payment_marked_at, payment_marked_by, converted_order_id, created_at, updated_at").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("找不到連線喊單。 ");
  return data;
}

async function ensureCustomer(customerId: string) {
  if (!uuidPattern.test(customerId)) throw new Error("請選擇一位客戶。 ");
  const { data, error } = await getSupabaseAdmin().from("customers").select("id, name, line_name, customer_category, preferred_delivery_method").eq("id", customerId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("找不到選擇的客戶。 ");
  return data;
}

async function rememberAlias(sourceInboxId: string | null, customerId: string, communityName: string) {
  if (!sourceInboxId || !communityName) return;
  const supabase = getSupabaseAdmin();
  const { data: inbox, error: inboxError } = await supabase.from("live_sale_inbox").select("line_user_id").eq("id", sourceInboxId).maybeSingle();
  if (inboxError || !inbox?.line_user_id) return;
  const { data: existing, error: lookupError } = await supabase.from("live_sale_customer_aliases").select("id").eq("line_user_id", inbox.line_user_id).eq("community_name", communityName).maybeSingle();
  if (lookupError) throw lookupError;
  const timestamp = new Date().toISOString();
  const result = existing
    ? await supabase.from("live_sale_customer_aliases").update({ customer_id: customerId, updated_at: timestamp }).eq("id", existing.id)
    : await supabase.from("live_sale_customer_aliases").insert({ customer_id: customerId, community_name: communityName, line_user_id: inbox.line_user_id, updated_at: timestamp });
  if (result.error) throw result.error;
}

type ResolvedItem = { product_id: string | null; product_name: string; category: string; specification: string; unit_price: number; quantity: number };

function combineItems(items: ResolvedItem[]) {
  const combined = new Map<string, ResolvedItem>();
  for (const item of items) {
    const itemKey = `${item.product_id ?? item.product_name}::${item.specification}::${item.unit_price}`;
    const current = combined.get(itemKey);
    combined.set(itemKey, current ? { ...current, quantity: current.quantity + item.quantity } : { ...item });
  }
  return [...combined.values()];
}

async function mergeIntoOpenClaim({ currentId, campaignId, customer, items, note }: { currentId: string; campaignId: string; customer: { id: string; name: string; line_name: string }; items: ResolvedItem[]; note: string }) {
  const supabase = getSupabaseAdmin();
  const { data: target, error: targetError } = await supabase
    .from("live_sale_claims")
    .select("id, claim_total, note")
    .eq("campaign_id", campaignId)
    .eq("customer_id", customer.id)
    .in("status", ["待核對", "待結帳"])
    .neq("id", currentId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target) return null;
  const { data: targetItems, error: targetItemsError } = await supabase.from("live_sale_claim_items").select("product_id, product_name, category, specification, unit_price, quantity").eq("claim_id", target.id);
  if (targetItemsError) throw targetItemsError;
  const mergedItems = combineItems([...(targetItems ?? []), ...items] as ResolvedItem[]);
  const total = mergedItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const nextNote = note && !target.note.includes(note) ? [target.note, note].filter(Boolean).join("\n") : target.note;
  const { error: headerError } = await supabase.from("live_sale_claims").update({ claim_total: total, note: nextNote, updated_at: new Date().toISOString() }).eq("id", target.id);
  if (headerError) throw headerError;
  const { error: deleteItemsError } = await supabase.from("live_sale_claim_items").delete().eq("claim_id", target.id);
  if (deleteItemsError) throw deleteItemsError;
  const { error: insertError } = await supabase.from("live_sale_claim_items").insert(mergedItems.map((item) => ({ claim_id: target.id, ...item })));
  if (insertError) throw insertError;
  const { error: deleteCurrentError } = await supabase.from("live_sale_claims").delete().eq("id", currentId);
  if (deleteCurrentError) throw deleteCurrentError;
  return target.id as string;
}

async function updateClaim(id: string, body: Record<string, unknown>) {
  const current = await fetchClaim(id);
  if (current.status === "已轉訂單") throw new Error("已轉為一般訂單的喊單不可再修改。 ");
  if (current.status === "已取消") throw new Error("已取消喊單請先復原後再修改。 ");
  const customerId = text(body.customerId);
  const communityName = text(body.communityName);
  const note = text(body.note);
  if (!communityName || communityName.length > 80) throw new Error("請填寫喊單來源。 ");
  const customer = customerId ? await ensureCustomer(customerId) : null;
  const items = await resolveItems(body.items);
  const total = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const resolved = Boolean(customer) && items.every((item) => Boolean(item.product_id));
  const status = current.status === "已結帳" ? "已結帳" : (resolved ? "待結帳" : "待核對");
  const supabase = getSupabaseAdmin();
  const { error: headerError } = await supabase.from("live_sale_claims").update({ customer_id: customer?.id ?? null, customer_name: customer?.name ?? "", line_name: customer?.line_name ?? "", community_name: communityName, note, status, claim_total: total, updated_at: new Date().toISOString() }).eq("id", id);
  if (headerError) throw headerError;
  const { error: deleteError } = await supabase.from("live_sale_claim_items").delete().eq("claim_id", id);
  if (deleteError) throw deleteError;
  const { error: itemError } = await supabase.from("live_sale_claim_items").insert(items.map((item) => ({ claim_id: id, ...item })));
  if (itemError) throw itemError;
  if (customer) await rememberAlias(current.source_inbox_id, customer.id, communityName);
  if (customer && resolved) {
    const mergedId = await mergeIntoOpenClaim({ currentId: id, campaignId: current.campaign_id, customer, items, note });
    if (mergedId) return { ...(await fetchClaim(mergedId)), items };
  }
  return { ...current, customer_id: customer?.id ?? null, customer_name: customer?.name ?? "", line_name: customer?.line_name ?? "", community_name: communityName, note, status, claim_total: total, updated_at: new Date().toISOString(), items };
}

async function markPaid(id: string, displayName: string) {
  const current = await fetchClaim(id);
  if (current.status === "已轉訂單") throw new Error("此喊單已轉為一般訂單。 ");
  if (current.status === "已取消") throw new Error("已取消喊單不可確認結單。 ");
  if (!current.customer_id) throw new Error("請先配對客戶後再確認結單。 ");
  const { data: items, error: itemError } = await getSupabaseAdmin().from("live_sale_claim_items").select("product_id, product_name, unit_price, quantity").eq("claim_id", id);
  if (itemError) throw itemError;
  if (!(items ?? []).length || (items ?? []).some((item) => !item.product_id || Number(item.unit_price) < 0 || Number(item.quantity) < 1)) throw new Error("請先完成所有商品核對後再確認結單。 ");
  const timestamp = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin().from("live_sale_claims").update({ status: "已結帳", payment_marked_at: timestamp, payment_marked_by: displayName, updated_at: timestamp }).eq("id", id).select("id, status, payment_marked_at, payment_marked_by, converted_order_id").single();
  if (error) throw error;
  return data;
}

async function setClaimStatus(id: string, action: string) {
  const current = await fetchClaim(id);
  if (current.status === "已轉訂單") throw new Error("已轉為一般訂單的喊單不可修改狀態。 ");
  const supabase = getSupabaseAdmin();
  if (action === "cancel") {
    const { data, error } = await supabase.from("live_sale_claims").update({ status: "已取消", updated_at: new Date().toISOString() }).eq("id", id).select("id, status").single();
    if (error) throw error;
    return data;
  }
  if (action === "restore" || action === "markUnpaid") {
    const { data: items, error: itemError } = await supabase.from("live_sale_claim_items").select("product_id").eq("claim_id", id);
    if (itemError) throw itemError;
    const status = current.customer_id && (items ?? []).every((item) => Boolean(item.product_id)) ? "待結帳" : "待核對";
    const { data, error } = await supabase.from("live_sale_claims").update({ status, payment_marked_at: null, payment_marked_by: "", updated_at: new Date().toISOString() }).eq("id", id).select("id, status, payment_marked_at, payment_marked_by").single();
    if (error) throw error;
    return data;
  }
  throw new Error("不支援的喊單狀態操作。 ");
}

async function setNotificationStatus(id: string, notificationStatus: string) {
  if (!['未通知', '已通知'].includes(notificationStatus)) throw new Error("通知狀態不正確。 ");
  const current = await fetchClaim(id);
  if (current.status !== "已轉訂單" || !current.converted_order_id) throw new Error("只有已結單可以更新通知狀態。 ");
  const { data, error } = await getSupabaseAdmin()
    .from("live_sale_claims")
    .update({ notification_status: notificationStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status, notification_status, converted_order_id")
    .single();
  if (error) throw error;
  return data;
}

async function deleteClaim(id: string) {
  const current = await fetchClaim(id);
  const supabase = getSupabaseAdmin();
  if (current.converted_order_id) {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, order_number")
      .eq("id", current.converted_order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (order?.status === "已出貨") throw new Error("這張已結單已出貨並扣除庫存，不能直接刪除；請以庫存調整方式修正。 ");
    if (order) {
      const { error } = await supabase.from("orders").delete().eq("id", order.id);
      if (error) throw error;
    }
  }
  const { error } = await supabase.from("live_sale_claims").delete().eq("id", id);
  if (error) throw error;
  return { id, convertedOrderId: current.converted_order_id };
}

async function convertToOrder(id: string) {
  const current = await fetchClaim(id);
  if (current.status !== "已結帳") throw new Error("請先由人員確認已結單後再轉一般訂單。 ");
  if (!current.customer_id) throw new Error("此喊單尚未配對客戶。 ");
  const supabase = getSupabaseAdmin();
  const [customer, campaign, itemsResult] = await Promise.all([
    ensureCustomer(current.customer_id),
    supabase.from("live_sale_campaigns").select("name, campaign_code").eq("id", current.campaign_id).maybeSingle(),
    supabase.from("live_sale_claim_items").select("product_id, product_name, unit_price, quantity").eq("claim_id", id),
  ]);
  if (campaign.error) throw campaign.error;
  if (!campaign.data) throw new Error("找不到原始連線檔期。 ");
  if (itemsResult.error) throw itemsResult.error;
  const sourceItems = itemsResult.data ?? [];
  if (!sourceItems.length || sourceItems.some((item) => !item.product_id)) throw new Error("尚有商品未完成核對，無法轉一般訂單。 ");
  const productIds = sourceItems.map((item) => item.product_id as string);
  const { data: products, error: productError } = await supabase.from("products").select("id, name, category, cost").in("id", productIds);
  if (productError || (products ?? []).length !== productIds.length) throw new Error("部分商品不存在，請重新核對後再轉訂單。 ");
  const productsById = new Map((products ?? []).map((product) => [product.id, product]));
  const subtotal = sourceItems.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
  const deliveryMethod = customer.preferred_delivery_method === "賣貨便" ? "賣貨便" : "門市自取";
  const deliveryFee = deliveryMethod === "賣貨便" && subtotal < 2500 ? 38 : 0;
  const costTotal = sourceItems.reduce((sum, item) => sum + (Number(productsById.get(item.product_id as string)?.cost) || 0) * Number(item.quantity), 0);
  const orderDate = taipeiToday();
  let createdOrderId = "";
  let createdOrder: Record<string, unknown> | null = null;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const orderNumber = await nextOrderNumber(orderDate);
      const { data: order, error: orderError } = await supabase.from("orders").insert({ order_number: orderNumber, customer_id: customer.id, order_date: orderDate, status: "預購中", order_method: "社群下單", payment_method: "銀行轉帳", reconciliation_status: "未付款", delivery_method: deliveryMethod, delivery_fee: deliveryFee, note: `連線檔期：${campaign.data.name}／喊單編號：${current.claim_number}${current.note ? `\n${current.note}` : ""}`, subtotal, total: subtotal + deliveryFee, net_profit: subtotal + deliveryFee - costTotal }).select("id, order_number, status, reconciliation_status, total").single();
      if (orderError) {
        if (orderError.code === "23505" && attempt < 2) continue;
        throw orderError;
      }
      createdOrderId = order.id;
      createdOrder = order;
      const { error: itemError } = await supabase.from("order_items").insert(sourceItems.map((item) => {
        const product = productsById.get(item.product_id as string)!;
        return { order_id: order.id, product_id: product.id, product_name: product.name, category: product.category, unit_price: Number(item.unit_price), unit_cost: Number(product.cost) || 0, quantity: Number(item.quantity) };
      }));
      if (itemError) throw itemError;
      break;
    }
    if (!createdOrderId || !createdOrder) throw new Error("無法取得一般訂單編號，請再試一次。 ");
    const { data: claim, error: claimError } = await supabase.from("live_sale_claims").update({ status: "已轉訂單", notification_status: "未通知", converted_order_id: createdOrderId, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "已結帳").select("id, status, notification_status, converted_order_id").maybeSingle();
    if (claimError) throw claimError;
    if (!claim) throw new Error("喊單狀態已變更，請重新整理後確認。 ");
    return { claim, order: createdOrder };
  } catch (error) {
    if (createdOrderId) await supabase.from("orders").delete().eq("id", createdOrderId);
    throw error;
  }
}

async function confirmAndConvert(id: string, displayName: string) {
  await markPaid(id, displayName);
  return convertToOrder(id);
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "連線喊單資料不正確。" }, { status: 400 });
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action);
    if (action === "update") return withRefreshedSession(NextResponse.json({ claim: await updateClaim(id, body) }), auth.context);
    if (action === "markPaid") return withRefreshedSession(NextResponse.json(await confirmAndConvert(id, auth.context.profile.displayName)), auth.context);
    if (action === "markUnpaid" || action === "cancel" || action === "restore") return withRefreshedSession(NextResponse.json({ claim: await setClaimStatus(id, action) }), auth.context);
    if (action === "setNotification") return withRefreshedSession(NextResponse.json({ claim: await setNotificationStatus(id, text(body.notificationStatus)) }), auth.context);
    if (action === "delete") return withRefreshedSession(NextResponse.json({ deleted: await deleteClaim(id) }), auth.context);
    if (action === "convert") return withRefreshedSession(NextResponse.json(await convertToOrder(id)), auth.context);
    return NextResponse.json({ message: "不支援的連線喊單操作。" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法更新連線喊單。") }, { status: 500 });
  }
}
