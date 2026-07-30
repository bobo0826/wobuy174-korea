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
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const nonNegativeInteger = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
};

function validateProduct(input: ProductInput) {
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
  };

  if (!product.sku || !product.name || !product.country || !product.category) {
    return { error: "請完整填寫商品編號、名稱、國家與商品種類。" };
  }

  if (Object.values(product).some((value) => value === null)) {
    return { error: "價格與庫存必須為零或正整數。" };
  }

  return { product };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
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
    const { data, error } = await supabase.from("products").insert(validation.product).select().single();
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
