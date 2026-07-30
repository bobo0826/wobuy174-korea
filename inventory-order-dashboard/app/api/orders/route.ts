import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type OrderItemInput = {
  productId?: unknown;
  productName?: unknown;
  category?: unknown;
  unitPrice?: unknown;
  unitCost?: unknown;
  quantity?: unknown;
};

type CreateOrderInput = {
  orderNumber?: unknown;
  customerId?: unknown;
  orderDate?: unknown;
  status?: unknown;
  orderMethod?: unknown;
  paymentMethod?: unknown;
  reconciliationStatus?: unknown;
  deliveryMethod?: unknown;
  note?: unknown;
  items?: unknown;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const orderNumberPattern = /^\d{8}\d{3,}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const orderStatuses = ["待確認", "已確認", "已出貨", "已取消"];
const orderMethods = ["社群下單", "員工下單"];
const paymentMethods = ["銀行轉帳", "信用卡", "現金"];
const reconciliationStatuses = ["待查帳", "已查帳", "查帳異常"];
const deliveryMethods = ["門市自取", "賣貨便"];

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const nonNegativeInteger = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
};

function datePrefix(orderDate: string) {
  return orderDate.replaceAll("-", "");
}

async function nextOrderNumber(orderDate: string) {
  const prefix = datePrefix(orderDate);
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("order_number")
    .like("order_number", `${prefix}%`);
  if (error) throw error;
  const lastSequence = (data ?? []).reduce((highest, order) => {
    const number = typeof order.order_number === "string" ? order.order_number : "";
    if (!new RegExp(`^${prefix}\\d{3,}$`).test(number)) return highest;
    return Math.max(highest, Number(number.slice(prefix.length)) || 0);
  }, 0);
  return `${prefix}${String(lastSequence + 1).padStart(3, "0")}`;
}

function validateOrder(input: CreateOrderInput) {
  const orderDate = text(input.orderDate);
  const orderNumber = text(input.orderNumber);
  const customerId = text(input.customerId);
  const status = text(input.status) || "已確認";
  const orderMethod = text(input.orderMethod);
  const paymentMethod = text(input.paymentMethod);
  const reconciliationStatus = text(input.reconciliationStatus) || "待查帳";
  const deliveryMethod = text(input.deliveryMethod);
  const note = text(input.note);

  if (!datePattern.test(orderDate)) return { error: "訂單日期格式不正確。" };
  if (orderNumber && !orderNumberPattern.test(orderNumber)) return { error: "訂單編號須為日期加上至少三位流水號，例如 20260730001。" };
  if (!orderStatuses.includes(status)) return { error: "訂單狀態不正確。" };
  if (!orderMethods.includes(orderMethod)) return { error: "請選擇下單方式。" };
  if (!paymentMethods.includes(paymentMethod)) return { error: "付款方式不正確。" };
  if (!reconciliationStatuses.includes(reconciliationStatus)) return { error: "查帳狀態不正確。" };
  if (!deliveryMethods.includes(deliveryMethod)) return { error: "配送方式不正確。" };
  if (!customerId || !uuidPattern.test(customerId)) return { error: "請先選擇一位已建立的客戶。" };
  if (!Array.isArray(input.items) || input.items.length === 0) return { error: "請至少加入一項商品。" };

  const items = (input.items as OrderItemInput[]).map((item) => {
    const productId = text(item.productId);
    return {
      product_id: productId,
      product_name: text(item.productName),
      category: text(item.category),
      unit_price: nonNegativeInteger(item.unitPrice),
      unit_cost: nonNegativeInteger(item.unitCost),
      quantity: nonNegativeInteger(item.quantity),
    };
  });

  if (items.some((item) => !uuidPattern.test(item.product_id) || !item.product_name || item.unit_price === null || item.unit_cost === null || item.quantity === null || item.quantity < 1)) {
    return { error: "商品資料不完整。請使用商品資料庫中已建立的商品建立訂單。" };
  }

  const subtotal = items.reduce((sum, item) => sum + (item.unit_price ?? 0) * (item.quantity ?? 0), 0);
  const costTotal = items.reduce((sum, item) => sum + (item.unit_cost ?? 0) * (item.quantity ?? 0), 0);
  const deliveryFee = deliveryMethod === "賣貨便" && subtotal < 2500 ? 38 : 0;

  return {
    order: {
      requestedOrderNumber: orderNumber,
      customerId,
      orderDate,
      status,
      orderMethod,
      paymentMethod,
      reconciliationStatus,
      deliveryMethod,
      deliveryFee,
      note,
      subtotal,
      total: subtotal + deliveryFee,
      netProfit: subtotal + deliveryFee - costTotal,
      items: items.map((item) => ({ ...item, quantity: item.quantity as number, unit_price: item.unit_price as number, unit_cost: item.unit_cost as number })),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const nextFor = new URL(request.url).searchParams.get("nextFor");
    if (nextFor) {
      if (!datePattern.test(nextFor)) return NextResponse.json({ message: "訂單日期格式不正確。" }, { status: 400 });
      return withRefreshedSession(NextResponse.json({ orderNumber: await nextOrderNumber(nextFor) }), auth.context);
    }

    const { data, error } = await getSupabaseAdmin()
      .from("orders")
      .select("id, order_number, order_date, status, order_method, payment_method, reconciliation_status, delivery_method, delivery_fee, note, subtotal, total, net_profit, created_at, customers(name, line_name, phone, address), order_items(id, product_id, product_name, category, unit_price, unit_cost, quantity)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ orders: data }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法讀取訂單資料。" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const validation = validateOrder(await request.json());
    if ("error" in validation) return NextResponse.json(validation, { status: 400 });

    const payload = validation.order;
    const supabase = getSupabaseAdmin();
    const orderNumber = payload.requestedOrderNumber || await nextOrderNumber(payload.orderDate);
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: payload.customerId,
        order_date: payload.orderDate,
        status: payload.status,
        order_method: payload.orderMethod,
        payment_method: payload.paymentMethod,
        reconciliation_status: payload.reconciliationStatus,
        delivery_method: payload.deliveryMethod,
        delivery_fee: payload.deliveryFee,
        note: payload.note,
        subtotal: payload.subtotal,
        total: payload.total,
        net_profit: payload.netProfit,
      })
      .select("id, order_number, status, total, net_profit")
      .single();
    if (orderError) {
      if (orderError.code === "23505") return NextResponse.json({ message: "訂單編號已存在，請重新開啟建立訂單頁以取得最新編號。" }, { status: 409 });
      throw orderError;
    }

    const { error: itemsError } = await supabase.from("order_items").insert(payload.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      category: item.category,
      unit_price: item.unit_price,
      unit_cost: item.unit_cost,
      quantity: item.quantity,
    })));
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }

    return withRefreshedSession(NextResponse.json({ order }, { status: 201 }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法建立訂單。" }, { status: 500 });
  }
}
