import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { syncProductToGoogleSheet } from "@/lib/google-sheets-sync";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ProductInput = {
  sku?: unknown;
  name?: unknown;
  country?: unknown;
  category?: unknown;
  specification?: unknown;
  cost?: unknown;
  staffPrice?: unknown;
  retailPrice?: unknown;
  availableStock?: unknown;
  safetyStock?: unknown;
  supplierId?: unknown;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nonNegativeInteger = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
};

function validateProduct(input: ProductInput) {
  const supplierId = text(input.supplierId);
  const product = {
    sku: text(input.sku),
    name: text(input.name),
    country: text(input.country),
    category: text(input.category),
    specification: text(input.specification),
    cost: nonNegativeInteger(input.cost),
    staff_price: nonNegativeInteger(input.staffPrice),
    retail_price: nonNegativeInteger(input.retailPrice),
    available_stock: nonNegativeInteger(input.availableStock),
    safety_stock: nonNegativeInteger(input.safetyStock),
    supplier_id: supplierId || null,
  };

  if (!product.sku || !product.name || !product.country || !product.category) {
    return { error: "請完整填寫商品編號、名稱、國家與商品種類。" };
  }

  if (supplierId && !uuidPattern.test(supplierId)) {
    return { error: "供應商資料不正確。" };
  }

  if ([product.cost, product.staff_price, product.retail_price, product.available_stock, product.safety_stock].some((value) => value === null)) {
    return { error: "價格與庫存必須為零或正整數。" };
  }

  return { product };
}

const productSelect = "*, suppliers(name)";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("products").select(productSelect).order("created_at", { ascending: false });
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ products: data }), auth.context);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "無法讀取商品資料。" },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const validation = validateProduct(await request.json());
    if ("error" in validation) return NextResponse.json(validation, { status: 400 });

    const supabase = getSupabaseAdmin();
    if (validation.product.supplier_id) {
      const { data: supplier, error: supplierError } = await supabase.from("suppliers").select("id").eq("id", validation.product.supplier_id).maybeSingle();
      if (supplierError) throw supplierError;
      if (!supplier) return NextResponse.json({ message: "找不到選擇的供應商。" }, { status: 400 });
    }
    const { data, error } = await supabase.from("products").insert(validation.product).select(productSelect).single();
    if (error) throw error;
    const sync = await syncProductToGoogleSheet(data);
    return withRefreshedSession(NextResponse.json({ product: data, sync }, { status: 201 }), auth.context);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "無法建立商品。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const body = await request.json();
    const id = text(body.id);
    const supplierId = text(body.supplierId);
    if (body.action !== "linkSupplier" || !uuidPattern.test(id)) return NextResponse.json({ message: "商品資料不正確。" }, { status: 400 });
    if (supplierId && !uuidPattern.test(supplierId)) return NextResponse.json({ message: "供應商資料不正確。" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    if (supplierId) {
      const { data: supplier, error: supplierError } = await supabase.from("suppliers").select("id").eq("id", supplierId).maybeSingle();
      if (supplierError) throw supplierError;
      if (!supplier) return NextResponse.json({ message: "找不到選擇的供應商。" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("products")
      .update({ supplier_id: supplierId || null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(productSelect)
      .single();
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ product: data }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法更新商品供應商。" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "商品資料不正確。" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: product, error: productError } = await supabase.from("products").select("id, name").eq("id", id).maybeSingle();
    if (productError) throw productError;
    if (!product) return NextResponse.json({ message: "找不到這項商品。" }, { status: 404 });

    const [orders, purchases, adjustments] = await Promise.all([
      supabase.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", id),
      supabase.from("purchase_order_items").select("id", { count: "exact", head: true }).eq("product_id", id),
      supabase.from("inventory_adjustments").select("id", { count: "exact", head: true }).eq("product_id", id),
    ]);
    const historyError = orders.error ?? purchases.error ?? adjustments.error;
    if (historyError) throw historyError;
    const relatedCount = (orders.count ?? 0) + (purchases.count ?? 0) + (adjustments.count ?? 0);
    if (relatedCount > 0) {
      return NextResponse.json({ message: `「${product.name}」已有 ${relatedCount} 筆訂單、採購或庫存異動紀錄，為保留歷史資料無法刪除。` }, { status: 409 });
    }

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ ok: true, id }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法刪除商品。" }, { status: 500 });
  }
}
