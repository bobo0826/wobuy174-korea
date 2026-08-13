import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { purchaseSelect } from "../route";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
type PurchaseItemInput = { productId?: unknown; unitCost?: unknown; quantity?: unknown };
type UpdatePurchaseInput = { action?: unknown; purchaseNumber?: unknown; supplierId?: unknown; orderDate?: unknown; arrivalDate?: unknown; paymentTerms?: unknown; items?: unknown };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const purchaseNumberPattern = /^PO-\d{8}\d{3,}$/;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const positiveInteger = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};
const nonNegativeInteger = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
};
const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
};
const missingDatabaseFunction = (error: { code?: string; message?: string } | null) => Boolean(error && (error.code === "PGRST202" || /receive_purchase_order/i.test(error.message ?? "") && /(function|schema cache|could not find)/i.test(error.message ?? "")));

function validateUpdate(input: UpdatePurchaseInput) {
  const supplierId = text(input.supplierId);
  const purchaseNumber = text(input.purchaseNumber);
  const orderDate = text(input.orderDate);
  const arrivalDate = text(input.arrivalDate);
  const paymentTerms = text(input.paymentTerms);
  if (!uuidPattern.test(supplierId)) return { error: "請選擇已建立的供應商。" };
  if (!purchaseNumberPattern.test(purchaseNumber)) return { error: "採購單編號格式不正確。" };
  if (!datePattern.test(orderDate)) return { error: "下單時間格式不正確。" };
  if (arrivalDate && !datePattern.test(arrivalDate)) return { error: "到貨時間格式不正確。" };
  if (!Array.isArray(input.items) || !input.items.length) return { error: "請至少加入一項採購商品。" };
  const items = (input.items as PurchaseItemInput[]).map((item) => ({ productId: text(item.productId), unitCost: nonNegativeInteger(item.unitCost), quantity: positiveInteger(item.quantity) }));
  if (items.some((item) => !uuidPattern.test(item.productId) || item.unitCost === null || item.quantity === null)) return { error: "採購商品資料不完整。" };
  if (new Set(items.map((item) => item.productId)).size !== items.length) return { error: "同一商品請合併為一筆採購明細。" };
  return { payload: { supplierId, purchaseNumber, orderDate, arrivalDate: arrivalDate || null, paymentTerms, items: items as Array<{ productId: string; unitCost: number; quantity: number }> } };
}

async function updatePurchaseOrder(id: string, input: UpdatePurchaseInput) {
  const validation = validateUpdate(input);
  if ("error" in validation) throw new Error(validation.error);
  const payload = validation.payload;
  const supabase = getSupabaseAdmin();
  const { data: current, error: currentError } = await supabase.from("purchase_orders").select("id, status, purchase_order_items(product_id, quantity, received_quantity)").eq("id", id).single();
  if (currentError || !current) throw new Error("找不到採購單。");
  if (current.status === "已完成" || current.status === "已取消") throw new Error("已完成或已取消的採購單不可修改。");
  if ((current.purchase_order_items ?? []).some((item) => item.received_quantity > 0)) throw new Error("採購單已有收貨紀錄，為維持庫存正確性不可再修改明細。");

  const { data: supplier, error: supplierError } = await supabase.from("suppliers").select("id, name").eq("id", payload.supplierId).single();
  if (supplierError || !supplier) throw new Error("找不到選擇的供應商。");
  const productIds = payload.items.map((item) => item.productId);
  const { data: products, error: productsError } = await supabase.from("products").select("id, name, incoming_stock").in("id", productIds);
  if (productsError || (products ?? []).length !== productIds.length) throw new Error("部分商品已不存在，請重新選擇。");
  const productsById = new Map((products ?? []).map((product) => [product.id, product]));
  const previousQuantities = new Map((current.purchase_order_items ?? []).filter((item) => item.product_id).map((item) => [item.product_id as string, item.quantity]));
  const nextQuantities = new Map(payload.items.map((item) => [item.productId, item.quantity]));
  const affectedProductIds = new Set([...previousQuantities.keys(), ...nextQuantities.keys()]);

  // 尚未收貨的採購單只調整「到貨中」，不會直接增加可售庫存。
  for (const productId of affectedProductIds) {
    const product = productsById.get(productId);
    if (!product) {
      const { data, error } = await supabase.from("products").select("id, incoming_stock").eq("id", productId).single();
      if (error || !data) throw new Error("部分商品已不存在，無法修改採購單。");
      const delta = (nextQuantities.get(productId) ?? 0) - (previousQuantities.get(productId) ?? 0);
      const { error: updateError } = await supabase.from("products").update({ incoming_stock: Math.max(0, data.incoming_stock + delta), updated_at: new Date().toISOString() }).eq("id", productId);
      if (updateError) throw updateError;
    } else {
      const delta = (nextQuantities.get(productId) ?? 0) - (previousQuantities.get(productId) ?? 0);
      const { error: updateError } = await supabase.from("products").update({ incoming_stock: Math.max(0, product.incoming_stock + delta), updated_at: new Date().toISOString() }).eq("id", productId);
      if (updateError) throw updateError;
    }
  }

  const total = payload.items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
  const { error: headerError } = await supabase.from("purchase_orders").update({ purchase_number: payload.purchaseNumber, supplier_id: supplier.id, supplier_name: supplier.name, order_date: payload.orderDate, arrival_date: payload.arrivalDate, expected_arrival_date: payload.arrivalDate, payment_terms: payload.paymentTerms, total, updated_at: new Date().toISOString() }).eq("id", id);
  if (headerError) throw headerError;
  const { error: deleteError } = await supabase.from("purchase_order_items").delete().eq("purchase_order_id", id);
  if (deleteError) throw deleteError;
  const { error: itemError } = await supabase.from("purchase_order_items").insert(payload.items.map((item) => ({ purchase_order_id: id, product_id: item.productId, product_name: productsById.get(item.productId)?.name ?? "", unit_cost: item.unitCost, quantity: item.quantity })));
  if (itemError) throw itemError;
  const { data, error } = await supabase.from("purchase_orders").select(purchaseSelect).eq("id", id).single();
  if (error) throw error;
  return data;
}

async function receivePurchaseOrderFallback(id: string, items: Array<{ item_id: string; quantity: number }>) {
  const supabase = getSupabaseAdmin();
  const { data: order, error: orderError } = await supabase
    .from("purchase_orders")
    .select("id, purchase_number, status, purchase_order_items(id, product_id, product_name, quantity, received_quantity)")
    .eq("id", id)
    .single();
  if (orderError || !order) throw new Error("找不到採購單。");
  if (order.status === "已完成" || order.status === "已取消") throw new Error("這張採購單目前無法收貨。");

  const linesById = new Map((order.purchase_order_items ?? []).map((line) => [line.id, line]));
  const requested = new Map(items.map((item) => [item.item_id, item.quantity]));
  const productIds = items.map((item) => linesById.get(item.item_id)?.product_id).filter((productId): productId is string => Boolean(productId));
  const { data: products, error: productsError } = await supabase.from("products").select("id, available_stock, incoming_stock").in("id", productIds);
  if (productsError) throw productsError;
  const productsById = new Map((products ?? []).map((product) => [product.id, product]));

  for (const item of items) {
    const line = linesById.get(item.item_id);
    if (!line) throw new Error("採購明細不屬於這張採購單。");
    if (!line.product_id) throw new Error(`${line.product_name} 未連結商品，無法入庫。`);
    const remaining = line.quantity - line.received_quantity;
    if (item.quantity > remaining) throw new Error(`${line.product_name} 的到貨數量超過尚待到貨數量。`);
    const product = productsById.get(line.product_id);
    if (!product) throw new Error(`${line.product_name} 已不存在，無法入庫。`);

    const { error: lineError } = await supabase.from("purchase_order_items").update({ received_quantity: line.received_quantity + item.quantity }).eq("id", line.id);
    if (lineError) throw lineError;
    const { error: productError } = await supabase.from("products").update({ available_stock: product.available_stock + item.quantity, incoming_stock: Math.max(0, product.incoming_stock - item.quantity), updated_at: new Date().toISOString() }).eq("id", line.product_id);
    if (productError) throw productError;
    const { error: adjustmentError } = await supabase.from("inventory_adjustments").insert({ product_id: line.product_id, quantity_change: item.quantity, reason: "採購收貨", note: `採購單 ${order.purchase_number}` });
    if (adjustmentError) throw adjustmentError;
  }

  const updatedLines = (order.purchase_order_items ?? []).map((line) => ({ ...line, received_quantity: line.received_quantity + (requested.get(line.id) ?? 0) }));
  const isComplete = updatedLines.every((line) => line.received_quantity >= line.quantity);
  const { error: headerError } = await supabase.from("purchase_orders").update({ status: isComplete ? "已完成" : "部分收貨", updated_at: new Date().toISOString() }).eq("id", id);
  if (headerError) throw headerError;

  const { data, error } = await supabase.from("purchase_orders").select(purchaseSelect).eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const body = await request.json();
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "採購單資料不正確。" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    if (body.action === "update") {
      const purchaseOrder = await updatePurchaseOrder(id, body);
      return withRefreshedSession(NextResponse.json({ purchaseOrder }), auth.context);
    }
    if (body.action !== "receive" || !Array.isArray(body.items)) return NextResponse.json({ message: "不支援的採購單操作。" }, { status: 400 });
    const items: Array<{ item_id: string; quantity: number | null }> = (body.items as Array<{ itemId?: unknown; quantity?: unknown }>).map((item) => ({ item_id: typeof item.itemId === "string" ? item.itemId : "", quantity: positiveInteger(item.quantity) }));
    if (!items.length || items.some((item) => !uuidPattern.test(item.item_id) || item.quantity === null)) return NextResponse.json({ message: "請填寫正確的收貨數量。" }, { status: 400 });
    const { error: receiptError } = await supabase.rpc("receive_purchase_order", { p_purchase_order_id: id, p_items: items, p_performed_by: auth.context.profile.displayName });
    if (receiptError && !missingDatabaseFunction(receiptError)) throw receiptError;
    const purchaseOrder = receiptError ? await receivePurchaseOrderFallback(id, items as Array<{ item_id: string; quantity: number }>) : await (async () => {
      const { data, error } = await supabase.from("purchase_orders").select(purchaseSelect).eq("id", id).single();
      if (error) throw error;
      return data;
    })();
    return withRefreshedSession(NextResponse.json({ purchaseOrder }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法完成採購單操作。") }, { status: 500 });
  }
}
