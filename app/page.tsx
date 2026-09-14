import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import Home, { type Category, type Product } from "./home-client";

export const revalidate = 60;

type StoredProduct = {
  id: string;
  name: string;
  price: string;
  original_price: string | null;
  code: string;
  deadline: string | null;
  arrival: string | null;
  colors: string | null;
  sizes: string | null;
  status: string;
  country: string;
  image_urls: string[] | null;
  categories: string[] | null;
  bedding_type: string | null;
  korea_type: string | null;
  details: string | null;
  specs: string | null;
  variants: unknown;
};

const productFields =
  "id,name,price,original_price,code,deadline,arrival,colors,sizes,status,country,image_urls,categories,bedding_type,korea_type,details,specs,variants";

function normalizeVariants(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((variant) => {
    if (!variant || typeof variant !== "object") return [];
    const record = variant as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const code = typeof record.code === "string" ? record.code.trim().toUpperCase() : "";
    const price = typeof record.price === "string" ? record.price.trim() : "";
    return name && price ? [{ name, code, price }] : [];
  });
}

function toProduct(product: StoredProduct): Product {
  const categories = (product.categories ?? []).filter((category) =>
    ["popular", "bedding", "korea", "japan", "other"].includes(category),
  ) as Category[];

  return {
    id: product.id,
    name: product.name,
    price: product.price,
    variants: normalizeVariants(product.variants),
    originalPrice: product.original_price ?? undefined,
    code: product.code,
    deadline: product.deadline ?? "請洽 LINE@",
    arrival: product.arrival ?? "依商品頁或客服通知",
    colors: product.colors ?? "請洽 LINE@",
    sizes: product.sizes ?? "請洽 LINE@",
    status: ["現貨", "預購", "連線中", "已收單"].includes(product.status)
      ? (product.status as Product["status"])
      : "預購",
    country: ["KOREA", "JAPAN", "SELECT"].includes(product.country)
      ? (product.country as Product["country"])
      : "SELECT",
    image: product.image_urls?.[0] ?? "",
    images: product.image_urls?.filter(Boolean).slice(0, 3) ?? [],
    categories,
    beddingType: ["cool", "allSeason", "pillow"].includes(product.bedding_type ?? "")
      ? (product.bedding_type as Product["beddingType"])
      : undefined,
    koreaType: ["plush", "pajamas", "fashion", "snacks", "beauty", "dutyFree", "socks"].includes(product.korea_type ?? "")
      ? (product.korea_type as Product["koreaType"])
      : undefined,
    details: product.details ?? "商品介紹請洽 LINE@ 官方帳號確認。",
    specs: product.specs ?? "尺寸、花色與供貨狀況請以客服確認為準。",
  };
}

const getPublishedProducts = unstable_cache(
  async (): Promise<Product[] | undefined> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return undefined;

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase
      .from("products")
      .select(productFields)
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    return error || !data ? undefined : (data as StoredProduct[]).map(toProduct);
  },
  ["published-products"],
  { revalidate },
);

export default async function Page() {
  const initialProducts = await getPublishedProducts().catch(() => undefined);

  return <Home initialProducts={initialProducts} />;
}
