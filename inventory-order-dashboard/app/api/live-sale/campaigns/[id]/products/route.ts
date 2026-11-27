import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { syncLiveSaleProductToGoogleSheet } from "@/lib/google-sheets-sync";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const amount = (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

function input(body: Record<string, unknown>) {
  const product = {
    name: text(body.name),
    country: text(body.country),
    category: text(body.category),
    subcategory: text(body.subcategory),
    specification: text(body.specification),
    local_price: amount(body.localPrice),
    cost: amount(body.cost),
    retail_price: amount(body.retailPrice),
    note: text(body.note),
  };
  if (!product.name || !product.country || product.local_price === null || product.cost === null || product.retail_price === null) {
    return { error: "請填寫商品名稱、國家、當地價格、台幣成本與一般售價。" };
  }
  return { product };
}

async function editableCampaign(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("live_sale_campaigns")
    .select("id, status, campaign_code, source_spreadsheet_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("找不到連線檔期。");
  if (data.status === "已封存") throw new Error("已封存檔期僅供查看，不能修改檔期商品。");
  return data;
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "連線檔期資料不正確。" }, { status: 400 });
    const { data, error } = await getSupabaseAdmin()
      .from("live_sale_products")
      .select("id, campaign_id, name, country, category, subcategory, specification, local_price, cost, retail_price, note, promoted_product_id, promoted_at, created_at, updated_at")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ products: data ?? [] }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法讀取檔期商品。") }, { status: 503 });
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "連線檔期資料不正確。" }, { status: 400 });
    const campaign = await editableCampaign(id);
    const validation = input(await request.json() as Record<string, unknown>);
    if ("error" in validation) return NextResponse.json(validation, { status: 400 });
    const { data, error } = await getSupabaseAdmin()
      .from("live_sale_products")
      .insert({ campaign_id: id, ...validation.product, created_by: auth.context.profile.displayName })
      .select("id, campaign_id, name, country, category, subcategory, specification, local_price, cost, retail_price, note, promoted_product_id, promoted_at, created_at, updated_at")
      .single();
    if (error) throw error;
    const sync = await syncLiveSaleProductToGoogleSheet({
      product: data,
      campaignCode: campaign.campaign_code,
      sourceSpreadsheetUrl: campaign.source_spreadsheet_url,
      action: "create",
    });
    return withRefreshedSession(NextResponse.json({ product: data, sync }, { status: 201 }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法建立檔期商品。") }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "連線檔期資料不正確。" }, { status: 400 });
    const campaign = await editableCampaign(id);
    const body = await request.json() as Record<string, unknown>;
    const productId = text(body.id);
    if (!uuidPattern.test(productId)) return NextResponse.json({ message: "檔期商品資料不正確。" }, { status: 400 });
    const validation = input(body);
    if ("error" in validation) return NextResponse.json(validation, { status: 400 });
    const { data: current, error: currentError } = await getSupabaseAdmin().from("live_sale_products").select("id, promoted_product_id").eq("id", productId).eq("campaign_id", id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ message: "找不到檔期商品。" }, { status: 404 });
    if (current.promoted_product_id) return NextResponse.json({ message: "此商品已有客人喊單，已轉為正式商品；請至商品資料庫修改。" }, { status: 409 });
    const { data, error } = await getSupabaseAdmin().from("live_sale_products").update({ ...validation.product, updated_at: new Date().toISOString() }).eq("id", productId).select("id, campaign_id, name, country, category, subcategory, specification, local_price, cost, retail_price, note, promoted_product_id, promoted_at, created_at, updated_at").single();
    if (error) throw error;
    const sync = await syncLiveSaleProductToGoogleSheet({
      product: data,
      campaignCode: campaign.campaign_code,
      sourceSpreadsheetUrl: campaign.source_spreadsheet_url,
      action: "update",
    });
    return withRefreshedSession(NextResponse.json({ product: data, sync }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法修改檔期商品。") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id } = await params;
    const productId = new URL(request.url).searchParams.get("id") ?? "";
    if (!uuidPattern.test(id) || !uuidPattern.test(productId)) return NextResponse.json({ message: "檔期商品資料不正確。" }, { status: 400 });
    await editableCampaign(id);
    const { data: product, error: productError } = await getSupabaseAdmin().from("live_sale_products").select("id, promoted_product_id").eq("id", productId).eq("campaign_id", id).maybeSingle();
    if (productError) throw productError;
    if (!product) return NextResponse.json({ message: "找不到檔期商品。" }, { status: 404 });
    if (product.promoted_product_id) return NextResponse.json({ message: "此商品已有客人喊單並已轉為正式商品，不能從檔期商品庫刪除。" }, { status: 409 });
    const { error } = await getSupabaseAdmin().from("live_sale_products").delete().eq("id", productId);
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ ok: true, id: productId }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法刪除檔期商品。") }, { status: 500 });
  }
}
