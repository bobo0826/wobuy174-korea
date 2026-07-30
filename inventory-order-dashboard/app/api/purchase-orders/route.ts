import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PurchaseItemInput = {
  productId?: unknown;
  unitCost?: unknown;
  quantity?: unknown;
};

type PurchaseOrderInput = {
  purchaseNumber?: unknown;
  supplierId?: unknown;
  expectedArrivalDate?: unknown;
  paymentTerms?: unknown;
  items?: unknown;
};

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

function taipeiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function nextPurchaseNumber(date: string) {
  const prefix = `PO-${date.replaceAll("-", "")}`;
  const { data, error } = await getSupabaseAdmin().from("purchase_orders").select("purchase_number").like("purchase_number", `${prefix}%`);
  if (error) throw error;
  const lastSequence = (data ?? []).reduce((highest, purchaseOrder) => {
    const number = typeof purchaseOrder.purchase_number === "string" ? purchaseOrder.purchase_number : "";
    if (!new RegExp(`^${prefix}\\d{3,}$`).test(number)) return highest;
    return Math.max(highest, Number(number.slice(prefix.length)) || 0);
  }, 0);
  return `${prefix}${String(lastSequence + 1).padStart(3, "0")}`;
}

function validatePurchaseOrder(input: PurchaseOrderInput) {
  const supplierId = text(input.supplierId);
  const expectedArrivalDate = text(input.expectedArrivalDate);
  const requestedPurchaseNumber = text(input.purchaseNumber);
  const paymentTerms = text(input.paymentTerms);
  if (!uuidPattern.test(supplierId)) return { error: "請選擇已建立的供應商。" };
  if (expectedArrivalDate && !datePattern.test(expectedArrivalDate)) return { error: "預計到貨日期格式不正確。" };
  if (requestedPurchaseNumber && !purchaseNumberPattern.test(requestedPurchaseNumber)) return { error: "採購單編號格式不正確。" };
  if (!Array.isArray(input.items) || input.items.length === 0) return { error: "請至少加入一項採購商品。" };

  const items = (input.items as PurchaseItemInput[]).map((item) => ({
    productId: text(item.productId),
    unitCost: nonNegativeInteger(item.unitCost),
    quantity: positiveInteger(item.quantity),
  }));
  if (items.some((item) => !uuidPattern.test(item.productId) || item.unitCost === null || item.quantity === null)) return { error: "採購商品資料不完整。" };
  if (new Set(items.map((item) => item.productId)).size !== items.length) return { error: "同一個商品請合併為一筆採購明細。" };

  return { purchase: { supplierId, expectedArrivalDate: expectedArrivalDate || null, requestedPurchaseNumber, paymentTerms, items: items as Array<{ productId: string; unitCost: number; quantity: number }> } };
}

const purchaseSelect = "id, purchase_number, supplier_id, supplier_name, expected_arrival_date, payment_terms, status, total, received_at, created_at, updated_at, purchase_order_items(id, product_id, product_name, unit_cost, quantity, received_quantity)";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const nextFor = new URL(request.url).searchParams.get("nextFor");
    if (nextFor) {
      if (!datePattern.test(nextFor)) return NextResponse.json({ message: "日期格式不正確。" }, { status: 400 });
      return withRefreshedSession(NextResponse.json({ purchaseNumber: await nextPurchaseNumber(nextFor) }), auth.context);
    }
    const { data, error } = await getSupabaseAdmin().from("purchase_orders").select(purchaseSelect).order("created_at", { ascending: false });
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ purchaseOrders: data ?? [] }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法讀取採購單。" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const validation = validatePurchaseOrder(await request.json());
    if ("error" in validation) return NextResponse.json(validation, { status: 400 });

    const payload = validation.purchase;
    const supabase = getSupabaseAdmin();
    const { data: supplier, error: supplierError } = await supabase.from("suppliers").select("id, name").eq("id", payload.supplierId).single();
    if (supplierError || !supplier) return NextResponse.json({ message: "找不到選擇的供應商。" }, { status: 400 });

    const productIds = payload.items.map((item) => item.productId);
    const { data: storedProducts, error: productError } = await supabase.from("products").select("id, name, incoming_stock").in("id", productIds);
    if (productError) throw productError;
    if ((storedProducts ?? []).length !== productIds.length) return NextResponse.json({ message: "部分商品已不存在，請重新選擇。" }, { status: 400 });
    const productsById = new Map((storedProducts ?? []).map((product) => [product.id, product]));
    const total = payload.items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
    const purchaseNumber = payload.requestedPurchaseNumber || await nextPurchaseNumber(taipeiDate());

    const { data: purchaseOrder, error: purchaseOrderError } = await supabase
      .from("purchase_orders")
      .insert({
        purchase_number: purchaseNumber,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        expected_arrival_date: payload.expectedArrivalDate,
        payment_terms: payload.paymentTerms,
        status: "待收貨",
        total,
      })
      .select("id, purchase_number")
      .single();
    if (purchaseOrderError) {
      if (purchaseOrderError.code === "23505") return NextResponse.json({ message: "採購單編號已存在，請重新開啟建立採購單頁面。" }, { status: 409 });
      throw purchaseOrderError;
    }

    const { error: itemsError } = await supabase.from("purchase_order_items").insert(payload.items.map((item) => ({
      purchase_order_id: purchaseOrder.id,
      product_id: item.productId,
      product_name: productsById.get(item.productId)?.name ?? "",
      unit_cost: item.unitCost,
      quantity: item.quantity,
    })));
    if (itemsError) {
      await supabase.from("purchase_orders").delete().eq("id", purchaseOrder.id);
      throw itemsError;
    }

    for (const item of payload.items) {
      const product = productsById.get(item.productId);
      if (!product) continue;
      const { error } = await supabase.from("products").update({ incoming_stock: product.incoming_stock + item.quantity, updated_at: new Date().toISOString() }).eq("id", item.productId);
      if (error) throw error;
    }

    const { data, error } = await supabase.from("purchase_orders").select(purchaseSelect).eq("id", purchaseOrder.id).single();
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ purchaseOrder: data }, { status: 201 }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法建立採購單。" }, { status: 500 });
  }
}
