import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
type OrderItemInput = { productId?: unknown; unitPrice?: unknown; quantity?: unknown };
type UpdateOrderInput = { action?: unknown; orderNumber?: unknown; customerId?: unknown; orderDate?: unknown; status?: unknown; orderMethod?: unknown; paymentMethod?: unknown; paymentStatus?: unknown; deliveryMethod?: unknown; note?: unknown; items?: unknown };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const orderNumberPattern = /^\d{8}\d{3,}$/;
const statuses = ["預購中", "未出貨", "已出貨", "已取消"];
const orderMethods = ["社群下單", "員工下單"];
const paymentMethods = ["銀行轉帳", "信用卡", "現金"];
const paymentStatuses = ["未付款", "已付款"];
const deliveryMethods = ["門市自取", "賣貨便"];
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const integer = (value: unknown) => { const number = Number(value); return Number.isInteger(number) && number >= 0 ? number : null; };
const orderSelect = "id, order_number, order_date, status, order_method, payment_method, reconciliation_status, delivery_method, delivery_fee, note, subtotal, total, net_profit, created_at, customers(id, name, line_name, phone, address), order_items(id, product_id, product_name, category, unit_price, unit_cost, quantity)";

function validateUpdate(input: UpdateOrderInput) {
  const orderNumber = text(input.orderNumber); const customerId = text(input.customerId); const orderDate = text(input.orderDate); const status = text(input.status); const orderMethod = text(input.orderMethod); const paymentMethod = text(input.paymentMethod); const paymentStatus = text(input.paymentStatus); const deliveryMethod = text(input.deliveryMethod); const note = text(input.note);
  if (!orderNumberPattern.test(orderNumber)) return { error: "訂單編號須為日期加上至少三位流水號。" };
  if (!uuidPattern.test(customerId)) return { error: "請選擇客戶。" };
  if (!datePattern.test(orderDate)) return { error: "訂單日期格式不正確。" };
  if (!statuses.includes(status) || status === "已出貨") return { error: "訂單狀態不正確；出貨請使用扣除庫存按鈕。" };
  if (!orderMethods.includes(orderMethod)) return { error: "請選擇下單方式。" };
  if (!paymentMethods.includes(paymentMethod) || !paymentStatuses.includes(paymentStatus) || !deliveryMethods.includes(deliveryMethod)) return { error: "付款或配送資料不正確。" };
  if (!Array.isArray(input.items) || !input.items.length) return { error: "請至少保留一項商品。" };
  const items = (input.items as OrderItemInput[]).map((item) => ({ productId: text(item.productId), unitPrice: integer(item.unitPrice), quantity: integer(item.quantity) }));
  if (items.some((item) => !uuidPattern.test(item.productId) || item.unitPrice === null || item.quantity === null || item.quantity < 1)) return { error: "訂購商品資料不完整。" };
  if (new Set(items.map((item) => item.productId)).size !== items.length) return { error: "同一商品請合併為一筆訂購明細。" };
  return { payload: { orderNumber, customerId, orderDate, status, orderMethod, paymentMethod, paymentStatus, deliveryMethod, note, items: items as Array<{ productId: string; unitPrice: number; quantity: number }> } };
}

async function completeOrder(id: string) {
  const supabase = getSupabaseAdmin();
  const { data: order, error: orderError } = await supabase.from("orders").select("id, status").eq("id", id).single();
  if (orderError || !order) throw new Error("找不到訂單。");
  if (order.status === "已出貨") throw new Error("此訂單已完成扣庫存。");
  if (order.status === "已取消") throw new Error("已取消的訂單無法扣除庫存。");
  const { data: items, error: itemsError } = await supabase.from("order_items").select("product_id, product_name, quantity").eq("order_id", id);
  if (itemsError) throw itemsError;
  const quantities = new Map<string, { name: string; quantity: number }>();
  for (const item of items ?? []) { if (!item.product_id) continue; const previous = quantities.get(item.product_id); quantities.set(item.product_id, { name: item.product_name, quantity: (previous?.quantity ?? 0) + item.quantity }); }
  const ids = [...quantities.keys()];
  const { data: products, error: productsError } = ids.length ? await supabase.from("products").select("id, available_stock").in("id", ids) : { data: [], error: null };
  if (productsError) throw productsError;
  const stocks = new Map((products ?? []).map((product) => [product.id, product.available_stock]));
  for (const [productId, item] of quantities) { const available = stocks.get(productId); if (available === undefined || available < item.quantity) throw new Error(`${item.name} 的可售庫存不足，無法扣庫存。`); }
  for (const [productId, item] of quantities) { const { error } = await supabase.from("products").update({ available_stock: (stocks.get(productId) ?? 0) - item.quantity, updated_at: new Date().toISOString() }).eq("id", productId); if (error) throw error; }
  if (ids.length) { const { error } = await supabase.from("inventory_adjustments").insert(ids.map((productId) => ({ product_id: productId, quantity_change: -(quantities.get(productId)?.quantity ?? 0), reason: "訂單完成扣庫存", note: `訂單 ${id}` }))); if (error) throw error; }
  const { data, error } = await supabase.from("orders").update({ status: "已出貨", updated_at: new Date().toISOString() }).eq("id", id).select(orderSelect).single();
  if (error) throw error;
  return data;
}

async function updateOrder(id: string, input: UpdateOrderInput) {
  const validation = validateUpdate(input); if ("error" in validation) throw new Error(validation.error);
  const payload = validation.payload; const supabase = getSupabaseAdmin();
  const { data: current, error: currentError } = await supabase.from("orders").select("status").eq("id", id).single();
  if (currentError || !current) throw new Error("找不到訂單。");
  if (current.status === "已出貨") throw new Error("訂單已扣庫存並出貨，不能直接修改；如需修正請先建立新的調整紀錄。 ");
  const { data: customer, error: customerError } = await supabase.from("customers").select("id").eq("id", payload.customerId).single();
  if (customerError || !customer) throw new Error("找不到選擇的客戶。");
  const productIds = payload.items.map((item) => item.productId);
  const { data: products, error: productError } = await supabase.from("products").select("id, name, category, cost").in("id", productIds);
  if (productError || (products ?? []).length !== productIds.length) throw new Error("部分商品已不存在，請重新選擇。");
  const productsById = new Map((products ?? []).map((product) => [product.id, product]));
  const subtotal = payload.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const costTotal = payload.items.reduce((sum, item) => sum + (productsById.get(item.productId)?.cost ?? 0) * item.quantity, 0);
  const deliveryFee = payload.deliveryMethod === "賣貨便" && subtotal < 2500 ? 38 : 0;
  const { error: headerError } = await supabase.from("orders").update({ order_number: payload.orderNumber, customer_id: payload.customerId, order_date: payload.orderDate, status: payload.status, order_method: payload.orderMethod, payment_method: payload.paymentMethod, reconciliation_status: payload.paymentStatus, delivery_method: payload.deliveryMethod, delivery_fee: deliveryFee, note: payload.note, subtotal, total: subtotal + deliveryFee, net_profit: subtotal + deliveryFee - costTotal, updated_at: new Date().toISOString() }).eq("id", id);
  if (headerError) throw headerError;
  const { error: deleteError } = await supabase.from("order_items").delete().eq("order_id", id); if (deleteError) throw deleteError;
  const { error: insertError } = await supabase.from("order_items").insert(payload.items.map((item) => ({ order_id: id, product_id: item.productId, product_name: productsById.get(item.productId)?.name ?? "", category: productsById.get(item.productId)?.category ?? "", unit_price: item.unitPrice, unit_cost: productsById.get(item.productId)?.cost ?? 0, quantity: item.quantity })));
  if (insertError) throw insertError;
  const { data, error } = await supabase.from("orders").select(orderSelect).eq("id", id).single(); if (error) throw error;
  return data;
}

async function updateShippedOrderPayment(id: string, input: UpdateOrderInput) {
  const paymentMethod = text(input.paymentMethod);
  const paymentStatus = text(input.paymentStatus);
  const note = text(input.note);
  if (!paymentMethods.includes(paymentMethod) || !paymentStatuses.includes(paymentStatus)) {
    throw new Error("付款資料不正確。");
  }

  const supabase = getSupabaseAdmin();
  const { data: current, error: currentError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", id)
    .single();
  if (currentError || !current) throw new Error("找不到訂單。");
  if (current.status !== "已出貨") throw new Error("這張訂單尚未出貨，請使用完整修改功能。");

  const { data, error } = await supabase
    .from("orders")
    .update({
      payment_method: paymentMethod,
      reconciliation_status: paymentStatus,
      note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(orderSelect)
    .single();
  if (error) throw error;
  return data;
}

export async function GET(request: NextRequest, { params }: Context) {
  try { const auth = await requireSignedIn(request); if (!auth.context) return auth.response!; const { id } = await params; if (!uuidPattern.test(id)) return NextResponse.json({ message: "訂單資料不正確。" }, { status: 400 }); const { data, error } = await getSupabaseAdmin().from("orders").select(orderSelect).eq("id", id).maybeSingle(); if (error) throw error; if (!data) return NextResponse.json({ message: "找不到這張訂單。" }, { status: 404 }); return withRefreshedSession(NextResponse.json({ order: data }), auth.context); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "無法讀取訂單資料。" }, { status: 503 }); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try { const auth = await requireSignedIn(request); if (!auth.context) return auth.response!; const { id } = await params; if (!uuidPattern.test(id)) return NextResponse.json({ message: "訂單資料不正確。" }, { status: 400 }); const body = await request.json() as UpdateOrderInput; if (body.action === "complete") return withRefreshedSession(NextResponse.json({ order: await completeOrder(id) }), auth.context); if (body.action === "update") return withRefreshedSession(NextResponse.json({ order: await updateOrder(id, body) }), auth.context); if (body.action === "updatePayment") return withRefreshedSession(NextResponse.json({ order: await updateShippedOrderPayment(id, body) }), auth.context); return NextResponse.json({ message: "不支援的訂單操作。" }, { status: 400 }); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "無法更新訂單。" }, { status: 500 }); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try { const auth = await requireSignedIn(request); if (!auth.context) return auth.response!; const { id } = await params; if (!uuidPattern.test(id)) return NextResponse.json({ message: "訂單資料不正確。" }, { status: 400 }); const { error } = await getSupabaseAdmin().rpc("delete_order_and_restore_stock", { p_order_id: id, p_performed_by: auth.context.profile.displayName }); if (error) throw error; return withRefreshedSession(NextResponse.json({ ok: true, id }), auth.context); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "無法刪除訂單。" }, { status: 500 }); }
}
