import { getSupabaseAdmin } from "@/lib/supabase";

type Campaign = { id: string; campaign_code: string };
type LiveProduct = {
  id: string;
  campaign_id: string;
  name: string;
  country: string;
  category: string;
  subcategory: string;
  specification: string;
  local_price: number;
  cost: number;
  retail_price: number;
  note: string;
  promoted_product_id: string | null;
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

async function nextLiveSaleSku(campaignCode: string) {
  const supabase = getSupabaseAdmin();
  const prefix = `LS-${campaignCode}-`;
  const { data, error } = await supabase
    .from("products")
    .select("sku")
    .like("sku", `${escapeLike(prefix)}%`);
  if (error) throw error;
  const sequence = (data ?? []).reduce((highest, item) => {
    const sku = typeof item.sku === "string" ? item.sku : "";
    const number = Number(sku.slice(prefix.length));
    return Number.isInteger(number) ? Math.max(highest, number) : highest;
  }, 0);
  return `${prefix}${String(sequence + 1).padStart(3, "0")}`;
}

export async function promoteLiveSaleProduct(
  campaign: Campaign,
  liveSaleProductId: string,
) {
  const supabase = getSupabaseAdmin();
  const { data: liveProduct, error: liveProductError } = await supabase
    .from("live_sale_products")
    .select("id, campaign_id, name, country, category, subcategory, specification, local_price, cost, retail_price, note, promoted_product_id")
    .eq("id", liveSaleProductId)
    .eq("campaign_id", campaign.id)
    .maybeSingle();
  if (liveProductError) throw liveProductError;
  if (!liveProduct) throw new Error("選擇的檔期商品不存在，請重新選擇。");

  const source = liveProduct as LiveProduct;
  if (source.promoted_product_id) {
    const { data: product, error } = await supabase
      .from("products")
      .select("id, sku, name, country, category, subcategory, specification, cost, retail_price")
      .eq("id", source.promoted_product_id)
      .maybeSingle();
    if (error) throw error;
    if (product) return { liveProduct: source, product };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const sku = await nextLiveSaleSku(campaign.campaign_code);
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        sku,
        name: source.name,
        country: source.country,
        category: source.category,
        subcategory: source.subcategory,
        specification: source.specification,
        note: source.note,
        cost: Number(source.cost) || 0,
        local_price: Number(source.local_price) || 0,
        staff_price: 0,
        retail_price: Number(source.retail_price) || 0,
        available_stock: 0,
        safety_stock: 0,
      })
      .select("id, sku, name, country, category, subcategory, specification, cost, retail_price")
      .maybeSingle();
    if (productError) {
      if (productError.code === "23505" && attempt < 2) continue;
      throw productError;
    }
    if (!product) throw new Error("無法建立正式商品。");
    const now = new Date().toISOString();
    const { data: linked, error: linkError } = await supabase
      .from("live_sale_products")
      .update({ promoted_product_id: product.id, promoted_at: now, updated_at: now })
      .eq("id", source.id)
      .is("promoted_product_id", null)
      .select("id")
      .maybeSingle();
    if (linkError) throw linkError;
    if (linked) return { liveProduct: source, product };

    const { data: current, error: currentError } = await supabase
      .from("live_sale_products")
      .select("promoted_product_id")
      .eq("id", source.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (current?.promoted_product_id) {
      await supabase.from("products").delete().eq("id", product.id);
      const { data: existingProduct, error: existingProductError } = await supabase
        .from("products")
        .select("id, sku, name, country, category, subcategory, specification, cost, retail_price")
        .eq("id", current.promoted_product_id)
        .maybeSingle();
      if (existingProductError) throw existingProductError;
      if (existingProduct) return { liveProduct: source, product: existingProduct };
    }
  }
  throw new Error("無法建立正式商品，請再試一次。");
}
