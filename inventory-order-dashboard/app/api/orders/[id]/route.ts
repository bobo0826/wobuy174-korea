import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
type UpdateOrderInput = {
  action?: unknown;
  status?: unknown;
  paymentMethod?: unknown;
  paymentStatus?: unknown;
  deliveryMethod?: unknown;
  note?: unknown;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = ["預購中", "已到貨", "已出貨", "已取消"];
const paymentMethods = ["銀行轉帳", "信用卡", "現金"];
const paymentStatuses = ["未付款", "已付款"];
const deliveryMethods = ["門市自取", "賣貨便"];
const orderSelect = "id, order_number, order_date, status, order_method, payment_method, reconciliation_status, delivery_method, delivery_fee, note, subtotal, total, net_profit, created_at, customers(name, line_name, phone, address), order_items(id, product_id, product_name, category, unit_price, unit_cost, quantity)";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function validateUpdate(input: UpdateOrderInput) {
  const status = text(input.status);
  const paymentMethod = text(input.paymentMethod);
  const paymentStatus = text(input.paymentStatus);
  const deliveryMethod = text(input.deliveryMethod);
  const note = text(input.note);
  if (!statuses.includes(status)) return { error: "訂單狀態不正確。" };
  if (!paymentMethods.includes(paymentMethod)) return { error: "付款方式不正確。" };
  if (!paymentStatuses.includes(paymentStatus)) return { error: "付款狀態不正確。" };
  if (!deliveryMethods.includes(deliveryMethod)) return { error: "配送方式不正確。" };
  return { update: { status, payment_method: paymentMethod, reconciliation_status: paymentStatus, delivery_method: deliveryMethod, note, updated_at: new Date().toISOString() } };
}

async function completeOrder(id: string, update: Record<string, string | number> = {}) {
  const supabase = getSupabaseAdmin();
  const { data: order, error: orderError } = await supabase.from("orders").select("id, status").eq("id", id).single();
  if (orderError) throw orderError;
  if (order.status === "已出貨") throw new Error("此訂單已完成扣庫存。");
  if (order.status === "已取消") throw new Error("已取消的訂單無法扣除庫存。");

  const { data: items, error: itemsError } = await supabase.from("order_items").select("product_id, product_name, quantity").eq("order_id", id);
  if (itemsError) throw itemsError;
  const productQuantities = new Map<string, { name: string; quantity: number }>();
  for (const item of items ?? []) {
    if (!item.product_id) continue;
    const existing = productQuantities.get(item.product_id);
    productQuantities.set(item.product_id, { name: item.product_name, quantity: (existing?.quantity ?? 0) + item.quantity });
  }

  const productIds = [...productQuantities.keys()];
  const { data: products, error: productsError } = productIds.length ? await supabase.from("products").select("id, available_stock").in("id", productIds) : { data: [], error: null };
  if (productsError) throw productsError;
  const stocks = new Map((products ?? []).map((product) => [product.id, product.available_stock]));
  for (const [productId, item] of productQuantities) {
    const available = stocks.get(productId);
    if (available === undefined || available < item.quantity) throw new Error(`${item.name} 的可售庫存不足，無法完成訂單。`);
  }
  for (const [productId, item] of productQuantities) {
    const available = stocks.get(productId) ?? 0;
    const { error: stockError } = await supabase.from("products").update({ available_stock: available - item.quantity, updated_at: new Date().toISOString() }).eq("id", productId);
    if (stockError) throw stockError;
  }
  if (productIds.length) {
    const { error: adjustmentError } = await supabase.from("inventory_adjustments").insert(productIds.map((productId) => ({ product_id: productId, quantity_change: -(productQuantities.get(productId)?.quantity ?? 0), reason: "訂單完成扣庫存", note: `訂單 ${id}` })));
    if (adjustmentError) throw adjustmentError;
  }
  const { data: completed, error: completeError } = await supabase.from("orders").update({ ...update, status: "已出貨", updated_at: new Date().toISOString() }).eq("id", id).select(orderSelect).single();
  if (completeError) throw completeError;
  return completed;
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "訂單資料不正確。" }, { status: 400 });
    const { data: order, error } = await getSupabaseAdmin().from("orders").select(orderSelect).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ message: "找不到這張訂單。" }, { status: 404 });
    return withRefreshedSession(NextResponse.json({ order }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法讀取訂單資料。" }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "訂單資料不正確。" }, { status: 400 });
    const body = await request.json() as UpdateOrderInput;

    if (body.action === "complete") {
      const order = await completeOrder(id);
      return withRefreshedSession(NextResponse.json({ order }), auth.context);
    }
    if (body.action !== "update") return NextResponse.json({ message: "不支援的訂單操作。" }, { status: 400 });
    const validation = validateUpdate(body);
    if ("error" in validation) return NextResponse.json(validation, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: current, error: currentError } = await supabase.from("orders").select("status, subtotal, delivery_fee, net_profit").eq("id", id).single();
    if (currentError) throw currentError;
    if (current.status === "已出貨" && validation.update.status !== "已出貨") return NextResponse.json({ message: "已出貨訂單不可回復為未出貨狀態，以免庫存紀錄不一致。" }, { status: 409 });

    const deliveryFee = validation.update.delivery_method === "賣貨便" && current.subtotal < 2500 ? 38 : 0;
    const costTotal = current.subtotal + current.delivery_fee - current.net_profit;
    const update = { ...validation.update, delivery_fee: deliveryFee, total: current.subtotal + deliveryFee, net_profit: current.subtotal + deliveryFee - costTotal };

    if (update.status === "已出貨" && current.status !== "已出貨") {
      const { status: _status, ...completionUpdate } = update;
      const order = await completeOrder(id, completionUpdate);
      return withRefreshedSession(NextResponse.json({ order }), auth.context);
    }
    const { data: order, error } = await supabase.from("orders").update(update).eq("id", id).select(orderSelect).single();
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ order }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法更新訂單。" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "訂單資料不正確。" }, { status: 400 });
    const { error } = await getSupabaseAdmin().rpc("delete_order_and_restore_stock", { p_order_id: id, p_performed_by: auth.context.profile.displayName });
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ ok: true, id }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法刪除訂單。" }, { status: 500 });
  }
}
