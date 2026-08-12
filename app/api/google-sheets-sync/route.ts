import { timingSafeEqual } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SheetProduct = Record<string, unknown>;

type ProductVariant = {
  name: string;
  code: string;
  price: string;
};

type ExistingProduct = {
  code: string;
  details: string | null;
  specs: string | null;
  image_urls: string[] | null;
  sort_order: number | null;
  variants: unknown;
};

const categoryAliases: Record<string, string> = {
  "熱門商品": "popular",
  "韓國棉被": "bedding",
  "韓國選品": "korea",
  "日本選品": "japan",
  "其他選品": "other",
  popular: "popular",
  bedding: "bedding",
  korea: "korea",
  japan: "japan",
  other: "other",
};

const koreaTypeAliases: Record<string, string> = {
  "正版玩偶": "plush",
  "正韓睡衣": "pajamas",
  "時尚潮牌": "fashion",
  "零食糖果": "snacks",
  "藥局美妝": "beauty",
  "免稅精選": "dutyFree",
  "純棉襪子": "socks",
  plush: "plush",
  pajamas: "pajamas",
  fashion: "fashion",
  snacks: "snacks",
  beauty: "beauty",
  dutyfree: "dutyFree",
  socks: "socks",
};

const beddingTypeAliases: Record<string, string> = {
  "涼感被": "cool",
  "涼被": "cool",
  "-18°C 涼被": "cool",
  cool: "cool",
  "四季被": "allSeason",
  allseason: "allSeason",
  "秒睡枕": "pillow",
  "抗蟎秒睡枕": "pillow",
  pillow: "pillow",
};

const validStatuses = new Set(["現貨", "預購", "連線中", "已收單"]);
const validCountries = new Set(["KOREA", "JAPAN", "SELECT"]);

function toText(value: unknown) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function getValue(product: SheetProduct, ...keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(product, key)) {
      return toText(product[key]);
    }
  }

  return "";
}

function splitValues(value: string) {
  return value
    .split(/[,，、|/；;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCountry(value: string) {
  const normalized = value.toUpperCase();
  if (validCountries.has(normalized)) return normalized;
  if (value === "韓國") return "KOREA";
  if (value === "日本") return "JAPAN";
  return "SELECT";
}

function isPublished(value: string) {
  return !["否", "no", "false", "0"].includes(value.toLowerCase());
}

function toSortOrder(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeVariants(value: unknown): ProductVariant[] {
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

function parseVariants(value: string): ProductVariant[] {
  return value
    .split(/[|｜\n]+/)
    .map((item) => {
      const parts = item.split(/[：:]/).map((part) => part.trim());
      if (parts.length < 2 || !parts[0]) return null;
      if (parts.length === 2) return parts[1] ? { name: parts[0], code: "", price: parts[1] } : null;
      const [name, code, ...priceParts] = parts;
      const price = priceParts.join("：").trim();
      return name && code && price ? { name, code: code.toUpperCase(), price } : null;
    })
    .filter((item): item is ProductVariant => Boolean(item));
}

function lowestVariantPrice(variants: ProductVariant[]) {
  return [...variants].sort((first, second) => {
    const firstValue = Number(first.price.replace(/[^\d.]/g, ""));
    const secondValue = Number(second.price.replace(/[^\d.]/g, ""));
    return (Number.isFinite(firstValue) ? firstValue : Number.POSITIVE_INFINITY) - (Number.isFinite(secondValue) ? secondValue : Number.POSITIVE_INFINITY);
  })[0]?.price ?? "";
}

function isValidSecret(providedSecret: string | null) {
  const expectedSecret = process.env.GOOGLE_SHEETS_SYNC_SECRET;
  if (!expectedSecret || !providedSecret) return false;

  const expected = Buffer.from(expectedSecret);
  const provided = Buffer.from(providedSecret);

  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

function toProductRecord(product: SheetProduct, existing?: ExistingProduct) {
  const code = getValue(product, "商品編號", "code").toUpperCase();
  const name = getValue(product, "品名", "name");
  const price = getValue(product, "優惠價", "基本優惠價", "價格", "price");
  const variantsValue = getValue(product, "子分類規格價格", "子分類規格", "variants");
  const variants = variantsValue ? parseVariants(variantsValue) : normalizeVariants(existing?.variants);
  const effectivePrice = price || lowestVariantPrice(variants);
  const originalPrice = getValue(product, "原價", "original_price");
  const statusValue = getValue(product, "貨況", "status");
  const country = normalizeCountry(getValue(product, "國別", "country") || "KOREA");
  const beddingType = beddingTypeAliases[
    getValue(product, "棉被子分類", "bedding_type").toLowerCase()
  ];
  const categories = Array.from(
    new Set(
      splitValues(getValue(product, "分類", "categories"))
        .map((item) => categoryAliases[item] ?? categoryAliases[item.toLowerCase()])
        .filter((item): item is string => Boolean(item)),
    ),
  );

  if (beddingType && !categories.includes("bedding")) categories.push("bedding");
  if (!categories.length) {
    categories.push(country === "JAPAN" ? "japan" : country === "KOREA" ? "korea" : "other");
  }

  if (!code || !name || !effectivePrice) {
    throw new Error("每列都必須有商品編號、品名與優惠價，或填寫子分類規格價格。");
  }

  const koreaType = koreaTypeAliases[
    getValue(product, "韓國子分類", "korea_type").toLowerCase()
  ];
  const detailsFromSheet = getValue(product, "商品介紹", "details");
  const specsFromSheet = getValue(product, "規格", "規格與注意事項", "specs");

  return {
    code,
    name,
    price: effectivePrice,
    variants,
    original_price: originalPrice || null,
    status: validStatuses.has(statusValue) ? statusValue : "預購",
    country,
    categories,
    korea_type: koreaType ?? null,
    bedding_type: beddingType ?? null,
    deadline: getValue(product, "收單日", "deadline") || null,
    arrival: getValue(product, "預計到貨", "arrival") || "依商品頁或客服通知",
    colors: getValue(product, "顏色", "colors") || null,
    sizes: getValue(product, "尺寸", "sizes") || null,
    details: detailsFromSheet || existing?.details || "商品介紹請洽 LINE@ 官方帳號確認。",
    specs: specsFromSheet || existing?.specs || "尺寸、花色與供貨狀況請以客服確認為準。",
    image_urls: existing?.image_urls ?? [],
    sort_order: toSortOrder(getValue(product, "排序", "sort_order"), existing?.sort_order ?? 0),
    published: isPublished(getValue(product, "是否發布", "published")),
  };
}

export async function POST(request: Request) {
  if (!isValidSecret(request.headers.get("x-sync-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "同步服務尚未完成設定。" },
      { status: 500 },
    );
  }

  let body: { products?: SheetProduct[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const products = Array.isArray(body.products) ? body.products : [];
  if (!products.length || products.length > 200) {
    return NextResponse.json(
      { error: "請一次同步 1 到 200 件商品。" },
      { status: 400 },
    );
  }

  const codes = products
    .map((product) => getValue(product, "商品編號", "code").toUpperCase())
    .filter(Boolean);

  if (new Set(codes).size !== codes.length) {
    return NextResponse.json({ error: "商品編號不可重複。" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: existingProducts, error: existingError } = await supabase
    .from("products")
    .select("code, details, specs, image_urls, sort_order, variants")
    .in("code", codes);

  if (existingError) {
    return NextResponse.json({ error: "讀取既有商品失敗。" }, { status: 500 });
  }

  const existingByCode = new Map(
    (existingProducts as ExistingProduct[] | null)?.map((product) => [product.code, product]),
  );

  let records;
  try {
    records = products.map((product) =>
      toProductRecord(product, existingByCode.get(getValue(product, "商品編號", "code").toUpperCase())),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "商品資料格式有誤。" },
      { status: 400 },
    );
  }

  const { error: upsertError } = await supabase
    .from("products")
    .upsert(records, { onConflict: "code" });

  if (upsertError) {
    const schemaHint = upsertError.message.includes("original_price") || upsertError.message.includes("colors") || upsertError.message.includes("sizes") || upsertError.message.includes("sort_order") || upsertError.message.includes("variants")
      ? "請先在 Supabase SQL Editor 重新執行 supabase/schema.sql。"
      : "";
    return NextResponse.json(
      { error: `同步失敗。${schemaHint}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ synced: records.length, codes: records.map((record) => record.code) });
}
