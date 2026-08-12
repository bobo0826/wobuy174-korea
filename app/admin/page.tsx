"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

const inputClass =
  "mt-2 w-full rounded-[4px] border border-[#D9D6D0] bg-[#F5F5F5] px-3 py-2.5 text-sm outline-none transition focus:border-[#605B51]";

const categoryAliases: Record<string, string> = {
  "熱門商品": "popular",
  popular: "popular",
  "韓國棉被": "bedding",
  bedding: "bedding",
  "韓國選品": "korea",
  korea: "korea",
  "日本選品": "japan",
  japan: "japan",
  "其他選品": "other",
  other: "other",
};

const koreaTypeAliases: Record<string, string> = {
  "正版玩偶": "plush",
  plush: "plush",
  "正韓睡衣": "pajamas",
  pajamas: "pajamas",
  "時尚潮牌": "fashion",
  fashion: "fashion",
  "零食糖果": "snacks",
  snacks: "snacks",
  "藥局美妝": "beauty",
  beauty: "beauty",
  "免稅精選": "dutyFree",
  dutyfree: "dutyFree",
  "純棉襪子": "socks",
  socks: "socks",
};

const beddingTypeAliases: Record<string, string> = {
  "-18°C 涼被": "cool",
  "涼被": "cool",
  cool: "cool",
  "四季被": "allSeason",
  allseason: "allSeason",
  "抗蟎秒睡枕": "pillow",
  "秒睡枕": "pillow",
  pillow: "pillow",
};

const categoryOptions = [
  { value: "popular", label: "熱門商品" },
  { value: "bedding", label: "韓國棉被" },
  { value: "korea", label: "韓國選品" },
  { value: "japan", label: "日本選品" },
  { value: "other", label: "其他選品" },
];

const koreaTypeOptions = [
  { value: "plush", label: "正版玩偶" },
  { value: "pajamas", label: "正韓睡衣" },
  { value: "fashion", label: "時尚潮牌" },
  { value: "snacks", label: "零食糖果" },
  { value: "beauty", label: "藥局美妝" },
  { value: "dutyFree", label: "免稅精選" },
  { value: "socks", label: "純棉襪子" },
];

const beddingTypeOptions = [
  { value: "cool", label: "涼感被" },
  { value: "allSeason", label: "四季被" },
  { value: "pillow", label: "秒睡枕" },
];

type CsvRow = Record<string, string>;

type ProductVariant = {
  name: string;
  price: string;
};

type ProductDraft = {
  code: string;
  name: string;
  price: string;
  variants: ProductVariant[];
  originalPrice: string;
  sortOrder: string;
  status: string;
  country: string;
  categories: string;
  koreaType: string;
  beddingType: string;
  deadline: string;
  arrival: string;
  colors: string;
  sizes: string;
  details: string;
  specs: string;
  published: boolean;
};

type ManagedProduct = {
  id: string;
  code: string;
  name: string;
  price: string;
  original_price: string | null;
  sort_order: number | null;
  status: string;
  country: string;
  categories: string[] | null;
  korea_type: string | null;
  bedding_type: string | null;
  deadline: string | null;
  arrival: string | null;
  colors: string | null;
  sizes: string | null;
  details: string | null;
  specs: string | null;
  variants: unknown;
  image_urls: string[] | null;
  published: boolean;
};

const emptyDraft: ProductDraft = {
  code: "",
  name: "",
  price: "",
  variants: [],
  originalPrice: "",
  sortOrder: "",
  status: "預購",
  country: "KOREA",
  categories: "",
  koreaType: "",
  beddingType: "",
  deadline: "",
  arrival: "依商品頁或客服通知",
  colors: "",
  sizes: "",
  details: "",
  specs: "",
  published: true,
};

function parseCsv(text: string) {
  const rows: string[][] = [[]];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      rows[rows.length - 1].push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      rows[rows.length - 1].push(cell.trim());
      cell = "";
      rows.push([]);
    } else {
      cell += character;
    }
  }

  rows[rows.length - 1].push(cell.trim());
  const [headerRow, ...dataRows] = rows.filter((row) => row.some((value) => value));
  if (!headerRow) return [];

  const headers = headerRow.map((header) => header.replace(/^\uFEFF/, "").trim());
  return dataRows.map((row) =>
    headers.reduce<CsvRow>((record, header, index) => {
      record[header] = row[index]?.trim() ?? "";
      return record;
    }, {}),
  );
}

function getValue(row: CsvRow, ...keys: string[]) {
  return keys.map((key) => row[key]).find((value) => value !== undefined)?.trim() ?? "";
}

function toList(value: string, aliases: Record<string, string>) {
  return value
    .split(/[,，、|/；;]+/)
    .map((item) => aliases[item.trim()] ?? aliases[item.trim().toLowerCase()])
    .filter((item): item is string => Boolean(item));
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
    const price = typeof record.price === "string" ? record.price.trim() : "";
    return name && price ? [{ name, price }] : [];
  });
}

function parseVariants(value: string): ProductVariant[] {
  return value
    .split(/[|｜\n]+/)
    .map((item) => {
      const separator = Math.max(item.indexOf("："), item.indexOf(":"));
      if (separator < 1) return null;
      const name = item.slice(0, separator).trim();
      const price = item.slice(separator + 1).trim();
      return name && price ? { name, price } : null;
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

function optionClass(selected: boolean) {
  return `rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
    selected
      ? "border-[#605B51] bg-[#605B51] text-[#F5F5F5]"
      : "border-[#D9D6D0] bg-[#F5F5F5] text-[#605B51] hover:border-[#605B51]"
  }`;
}

function toDraft(row: CsvRow): ProductDraft {
  const isPublished = getValue(row, "是否發布", "published").toLowerCase();
  return {
    code: getValue(row, "商品編號", "code").toUpperCase(),
    name: getValue(row, "品名", "name"),
    price: getValue(row, "價格", "優惠價", "基本優惠價", "price"),
    variants: parseVariants(getValue(row, "子分類規格價格", "子分類規格", "variants")),
    originalPrice: getValue(row, "原價", "original_price"),
    sortOrder: getValue(row, "排序", "sort_order"),
    status: getValue(row, "貨況", "status") || "預購",
    country: getValue(row, "國別", "country").toUpperCase() || "KOREA",
    categories: toList(getValue(row, "分類", "categories"), categoryAliases).join(","),
    koreaType:
      toList(getValue(row, "韓國子分類", "korea_type"), koreaTypeAliases)[0] ?? "",
    beddingType:
      toList(getValue(row, "棉被子分類", "bedding_type"), beddingTypeAliases)[0] ?? "",
    deadline: getValue(row, "收單日", "deadline"),
    arrival: getValue(row, "預計到貨", "arrival") || "依商品頁或客服通知",
    colors: getValue(row, "顏色", "colors"),
    sizes: getValue(row, "尺寸", "sizes"),
    details: getValue(row, "商品介紹", "details"),
    specs: getValue(row, "規格", "specs"),
    published: !["否", "no", "false", "0"].includes(isPublished),
  };
}

function toRecord(draft: ProductDraft, imageUrls: string[], fallbackSortOrder = 0) {
  const variants = normalizeVariants(draft.variants);
  return {
    code: draft.code.trim().toUpperCase(),
    name: draft.name.trim(),
    price: draft.price.trim() || lowestVariantPrice(variants),
    variants,
    original_price: draft.originalPrice.trim() || null,
    sort_order: toSortOrder(draft.sortOrder, fallbackSortOrder),
    status: ["現貨", "預購", "連線中", "已收單"].includes(draft.status)
      ? draft.status
      : "預購",
    country: ["KOREA", "JAPAN", "SELECT"].includes(draft.country)
      ? draft.country
      : "SELECT",
    categories: toList(draft.categories, categoryAliases),
    korea_type: toList(draft.koreaType, koreaTypeAliases)[0] ?? null,
    bedding_type: toList(draft.beddingType, beddingTypeAliases)[0] ?? null,
    deadline: draft.deadline.trim() || null,
    arrival: draft.arrival.trim() || null,
    colors: draft.colors.trim() || null,
    sizes: draft.sizes.trim() || null,
    details: draft.details.trim() || null,
    specs: draft.specs.trim() || null,
    image_urls: imageUrls,
    published: draft.published,
  };
}

function toDraftFromProduct(product: ManagedProduct): ProductDraft {
  return {
    code: product.code,
    name: product.name,
    price: product.price,
    variants: normalizeVariants(product.variants),
    originalPrice: product.original_price ?? "",
    sortOrder: String(product.sort_order ?? 0),
    status: product.status,
    country: product.country,
    categories: (product.categories ?? []).join(","),
    koreaType: product.korea_type ?? "",
    beddingType: product.bedding_type ?? "",
    deadline: product.deadline ?? "",
    arrival: product.arrival ?? "依商品頁或客服通知",
    colors: product.colors ?? "",
    sizes: product.sizes ?? "",
    details: product.details ?? "",
    specs: product.specs ?? "",
    published: product.published,
  };
}

function imagesForCode(files: File[], code: string) {
  const prefix = code.trim().toUpperCase();
  return files
    .filter((file) => file.name.toUpperCase().startsWith(prefix))
    .sort((first, second) => first.name.localeCompare(second.name))
    .slice(0, 3);
}

async function uploadImages(supabase: SupabaseClient, code: string, files: File[]) {
  const imageUrls: string[] = [];

  for (const [index, file] of files.slice(0, 3).entries()) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${code}/${Date.now()}-${index}-${safeName}`;
    const { error } = await supabase.storage.from("product-images").upload(filePath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

    if (error) throw error;
    imageUrls.push(supabase.storage.from("product-images").getPublicUrl(filePath).data.publicUrl);
  }

  return imageUrls;
}

async function saveProduct(
  supabase: SupabaseClient,
  draft: ProductDraft,
  imageFiles: File[],
) {
  const variants = normalizeVariants(draft.variants);
  const hasIncompleteVariant = draft.variants.some((variant) =>
    Boolean(variant.name.trim()) !== Boolean(variant.price.trim()),
  );
  if (!draft.code.trim() || !draft.name.trim() || (!draft.price.trim() && !variants.length)) {
    throw new Error("商品編號、品名與基本優惠價或子分類規格價格為必填欄位。");
  }
  if (hasIncompleteVariant) {
    throw new Error("每個子分類規格都需要填寫規格名稱與優惠價。");
  }
  if (!toList(draft.categories, categoryAliases).length) {
    throw new Error("請至少選擇一個主分類。");
  }

  const code = draft.code.trim().toUpperCase();
  const { data: existing, error: existingError } = await supabase
    .from("products")
    .select("image_urls, sort_order")
    .eq("code", code)
    .maybeSingle();
  if (existingError) throw existingError;

  const newImageUrls = imageFiles.length ? await uploadImages(supabase, code, imageFiles) : [];
  const imageUrls = newImageUrls.length ? newImageUrls : (existing?.image_urls ?? []);
  const { error } = await supabase
    .from("products")
    .upsert(toRecord({ ...draft, code }, imageUrls, existing?.sort_order ?? 0), { onConflict: "code" });
  if (error) {
    if (error.message.includes("variants")) {
      throw new Error("請先在 Supabase SQL Editor 執行「子分類規格」資料庫更新後再儲存商品。");
    }
    throw error;
  }
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [singleImages, setSingleImages] = useState<File[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [batchImages, setBatchImages] = useState<File[]>([]);
  const [batchResult, setBatchResult] = useState("");
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setMessage("找不到 Supabase 登入設定，請重新啟動本機預覽後再試一次。");
      return;
    }

    if (!email.trim() || !password) {
      setMessage("請先完整輸入 Email 與密碼。");
      return;
    }

    setIsBusy(true);
    setMessage("正在驗證登入資料…");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(`登入失敗：${error.message}`);
        return;
      }

      if (data.user) setUser(data.user);
      setMessage("登入成功，正在開啟商品管理…");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "請確認網路後再試一次。";
      setMessage(`無法連線至登入服務：${detail}`);
    } finally {
      setIsBusy(false);
    }
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setMessage("已登出。");
  };

  const saveSingleProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setIsBusy(true);
    setMessage("正在上傳商品與照片…");
    try {
      await saveProduct(supabase, draft, singleImages);
      setMessage(`已儲存商品：${draft.code}`);
      setDraft(emptyDraft);
      setSingleImages([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上傳失敗，請稍後再試。");
    } finally {
      setIsBusy(false);
    }
  };

  const importCsv = async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !csvFile) return;

    setIsBusy(true);
    setBatchResult("");
    const rows = parseCsv(await csvFile.text()).map(toDraft);
    const validRows = rows.filter((row) => row.code && row.name && (row.price || row.variants.length));
    if (!validRows.length) {
      setBatchResult("找不到可匯入資料，請確認 CSV 包含商品編號、品名與基本優惠價或子分類規格價格。");
      setIsBusy(false);
      return;
    }

    let succeeded = 0;
    const failed: string[] = [];
    const withoutImages: string[] = [];

    for (const [index, row] of validRows.entries()) {
      const matchingImages = imagesForCode(batchImages, row.code);
      setBatchResult(`正在匯入 ${index + 1}/${validRows.length}：${row.code}`);
      try {
        await saveProduct(supabase, row, matchingImages);
        succeeded += 1;
        if (!matchingImages.length) withoutImages.push(row.code);
      } catch (error) {
        failed.push(`${row.code}${error instanceof Error ? `（${error.message}）` : ""}`);
      }
    }

    setBatchResult(
      `完成：成功 ${succeeded} 件${withoutImages.length ? `；未配對照片 ${withoutImages.join("、")}` : ""}${failed.length ? `；失敗 ${failed.join("、")}` : ""}`,
    );
    setIsBusy(false);
  };

  useEffect(() => {
    if (!user) return;
    const code = new URLSearchParams(window.location.search).get("edit")?.trim().toUpperCase();
    if (!code) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    void supabase
      .from("products")
      .select("*")
      .eq("code", code)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setMessage(error ? `讀取商品失敗：${error.message}` : "找不到要編輯的商品。");
          return;
        }

        setDraft(toDraftFromProduct(data as ManagedProduct));
        setSingleImages([]);
        window.setTimeout(() => {
          document.getElementById("single-product-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      });
  }, [user]);

  const selectedCategories = toList(draft.categories, categoryAliases);
  const hasCategory = (category: string) => selectedCategories.includes(category);
  const toggleCategory = (category: string) => {
    setDraft((current) => {
      const currentCategories = toList(current.categories, categoryAliases);
      const isSelected = currentCategories.includes(category);
      const nextCategories = isSelected
        ? currentCategories.filter((value) => value !== category)
        : [...currentCategories, category];

      return {
        ...current,
        categories: nextCategories.join(","),
        country:
          !isSelected && category === "japan"
            ? "JAPAN"
            : !isSelected && (category === "korea" || category === "bedding")
              ? "KOREA"
              : current.country,
        koreaType: isSelected && category === "korea" ? "" : current.koreaType,
        beddingType: isSelected && category === "bedding" ? "" : current.beddingType,
      };
    });
  };

  const addVariant = () => {
    setDraft((current) => ({
      ...current,
      variants: [...current.variants, { name: "", price: "" }],
    }));
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: string) => {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: value } : variant,
      ),
    }));
  };

  const removeVariant = (index: number) => {
    setDraft((current) => ({
      ...current,
      variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
    }));
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen bg-[#F5F5F5] px-5 py-12 text-[#605B51] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl rounded-[6px] border border-[#D9D6D0] bg-[#EAE8E4] p-7 sm:p-10">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-[#605B51]/65">WOBUY174_ ADMIN</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">先連接商品資料庫</h1>
          <p className="mt-5 text-sm leading-7">請先建立 Supabase 專案，並將 `.env.example` 的兩個設定填入 `.env.local` 與 Vercel 環境變數。完成後重新部署，這個後台就會開放登入與批量上傳。</p>
          <Link className="mt-7 inline-flex rounded-full bg-[#605B51] px-5 py-3 text-sm font-medium text-[#F5F5F5]" href="/">
            回到網站首頁
          </Link>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#F5F5F5] px-5 py-12 text-[#605B51] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-md rounded-[6px] border border-[#D9D6D0] bg-[#EAE8E4] p-7 sm:p-10">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-[#605B51]/65">WOBUY174_ ADMIN</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">商品管理後台</h1>
          <p className="mt-4 text-sm leading-7 text-[#605B51]/75">請使用已加入管理權限的帳號登入。</p>
          <form className="mt-7 space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); void signIn(); }}>
            <label className="block text-sm font-medium">Email<input aria-required="true" className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label className="block text-sm font-medium">密碼<input aria-required="true" className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <Link className="inline-block text-sm font-medium underline underline-offset-4 transition-opacity hover:opacity-65" href="/admin/reset-password">忘記密碼？重新設定</Link>
            <button className="w-full rounded-full bg-[#605B51] px-5 py-3 text-sm font-medium text-[#F5F5F5] disabled:opacity-50" disabled={isBusy} onClick={() => void signIn()} type="button">{isBusy ? "登入中…" : "登入後台"}</button>
          </form>
          {message && <p className="mt-4 text-sm leading-6 text-[#605B51]/75">{message}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F5F5] pb-16 text-[#605B51]">
      <header className="border-b border-[#D9D6D0] px-5 py-5 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
          <div><p className="text-lg font-semibold tracking-[0.1em]">信男代購</p><p className="mt-1 text-[10px] tracking-[0.2em] text-[#605B51]/65">WOBUY174_ ADMIN</p></div>
          <div className="flex items-center gap-4 text-xs"><Link className="border-b border-[#605B51] pb-1" href="/admin/products">商品列表</Link><span className="hidden text-[#605B51]/65 sm:block">{user.email}</span><button className="border-b border-[#605B51] pb-1" onClick={signOut}>登出</button></div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8 sm:py-12 lg:px-0">
        <section className="rounded-[6px] border border-[#D9D6D0] bg-[#EAE8E4] p-6 sm:p-8">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-[#605B51]/65">BULK IMPORT</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">批量上傳商品</h1>
          <ol className="mt-5 grid gap-3 text-sm leading-6 text-[#605B51]/80 md:grid-cols-3">
            <li><span className="mr-2 font-semibold">01</span>下載 CSV 範本並填入商品資料。</li>
            <li><span className="mr-2 font-semibold">02</span>每件最多 3 張，照片請以「商品編號-1.jpg」命名。</li>
            <li><span className="mr-2 font-semibold">03</span>一次選取 CSV 與所有照片後開始匯入。</li>
          </ol>
          <a className="mt-5 inline-flex border-b border-[#605B51] pb-1 text-sm font-medium" href="/products-template.csv" download>下載 CSV 範本</a>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium">商品 CSV<input className={inputClass} accept=".csv,text/csv" type="file" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} /></label>
            <label className="block text-sm font-medium">商品照片（可一次多選）<input className={inputClass} accept="image/*" multiple type="file" onChange={(event) => setBatchImages(Array.from(event.target.files ?? []))} /></label>
          </div>
          <button className="mt-6 rounded-full bg-[#605B51] px-6 py-3 text-sm font-medium text-[#F5F5F5] disabled:opacity-50" disabled={!csvFile || isBusy} onClick={importCsv}>{isBusy ? "處理中…" : "開始批量匯入"}</button>
          {batchResult && <p className="mt-4 text-sm leading-7 text-[#605B51]/80">{batchResult}</p>}
        </section>

        <section className="mt-8 flex flex-wrap items-center justify-between gap-5 border-y border-[#D9D6D0] py-7">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.22em] text-[#605B51]/65">PRODUCT MANAGEMENT</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">商品列表、分類與排序</h2>
            <p className="mt-2 text-sm leading-6 text-[#605B51]/70">集中管理商品分類、前台顯示與排列順序。</p>
          </div>
          <Link className="rounded-full bg-[#605B51] px-5 py-3 text-sm font-medium text-[#F5F5F5]" href="/admin/products">前往商品列表</Link>
        </section>

        <section className="mt-8 border-t border-[#D9D6D0] pt-8" id="single-product-form">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-[#605B51]/65">SINGLE PRODUCT</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">單筆新增或更新</h2>
          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={saveSingleProduct}>
            {[
              ["商品編號", "code", "例如 KR-400"],
              ["品名", "name", "商品名稱"],
              ["原價", "originalPrice", "例如 NT$ 890"],
              ["基本優惠價", "price", "未設定子分類規格時使用，例如 NT$ 690"],
              ["商品排序", "sortOrder", "數字越小越前面；未填為 0"],
              ["收單日", "deadline", "例如 08/15"],
              ["預計到貨", "arrival", "依商品頁或客服通知"],
              ["顏色", "colors", "例如 棕色、米白"],
              ["尺寸", "sizes", "例如 S、Q"],
            ].map(([label, key, placeholder]) => (
              <label className="block text-sm font-medium" key={key}>{label}<input className={inputClass} placeholder={placeholder} value={draft[key as keyof ProductDraft] as string} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} /></label>
            ))}
            <fieldset className="rounded-[6px] border border-[#D9D6D0] bg-[#EAE8E4]/45 p-4 md:col-span-2 sm:p-5">
              <legend className="text-sm font-semibold">子分類規格與價格</legend>
              <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-2xl text-xs leading-5 text-[#605B51]/65">例如「單人／雙人」、「粉色／藍色」有不同價格時，在此新增。前台會讓客人選擇規格並顯示對應優惠價。</p>
                <button className="rounded-full border border-[#605B51] px-3 py-2 text-xs font-semibold transition-colors hover:bg-[#605B51] hover:text-[#F5F5F5]" onClick={addVariant} type="button">＋ 新增規格</button>
              </div>
              {draft.variants.length > 0 && (
                <div className="mt-4 space-y-3">
                  {draft.variants.map((variant, index) => (
                    <div className="grid gap-3 rounded-[4px] border border-[#D9D6D0] bg-[#FAF7F0] p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" key={`variant-${index}`}>
                      <label className="block text-sm font-medium">規格名稱<input className={inputClass} placeholder="例如 單人 S" value={variant.name} onChange={(event) => updateVariant(index, "name", event.target.value)} /></label>
                      <label className="block text-sm font-medium">優惠價<input className={inputClass} placeholder="例如 NT$ 1,350" value={variant.price} onChange={(event) => updateVariant(index, "price", event.target.value)} /></label>
                      <button className="border-b border-[#A81515] pb-1 text-left text-sm font-medium text-[#A81515] sm:mb-2 sm:text-center" onClick={() => removeVariant(index)} type="button">刪除</button>
                    </div>
                  ))}
                </div>
              )}
            </fieldset>
            <fieldset className="md:col-span-2">
              <legend className="text-sm font-medium">主分類</legend>
              <p className="mt-2 text-xs leading-5 text-[#605B51]/65">可複選「熱門商品」與其他主分類；其餘分類請依商品選擇。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {categoryOptions.map((option) => (
                  <button aria-pressed={hasCategory(option.value)} className={optionClass(hasCategory(option.value))} key={option.value} onClick={() => toggleCategory(option.value)} type="button">
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
            {hasCategory("korea") && (
              <fieldset className="md:col-span-2">
                <legend className="text-sm font-medium">韓國選品子分類</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {koreaTypeOptions.map((option) => (
                    <button aria-pressed={draft.koreaType === option.value} className={optionClass(draft.koreaType === option.value)} key={option.value} onClick={() => setDraft((current) => ({ ...current, koreaType: current.koreaType === option.value ? "" : option.value }))} type="button">
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {hasCategory("bedding") && (
              <fieldset className="md:col-span-2">
                <legend className="text-sm font-medium">韓國棉被子分類</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {beddingTypeOptions.map((option) => (
                    <button aria-pressed={draft.beddingType === option.value} className={optionClass(draft.beddingType === option.value)} key={option.value} onClick={() => setDraft((current) => ({ ...current, beddingType: current.beddingType === option.value ? "" : option.value }))} type="button">
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="block text-sm font-medium">貨況<select className={inputClass} value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}><option>現貨</option><option>預購</option><option>連線中</option><option>已收單</option></select></label>
            <label className="block text-sm font-medium">國別<select className={inputClass} value={draft.country} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))}><option value="KOREA">KOREA</option><option value="JAPAN">JAPAN</option><option value="SELECT">SELECT</option></select></label>
            <label className="block text-sm font-medium md:col-span-2">商品介紹<textarea className={inputClass} rows={3} value={draft.details} onChange={(event) => setDraft((current) => ({ ...current, details: event.target.value }))} /></label>
            <label className="block text-sm font-medium md:col-span-2">規格與注意事項<textarea className={inputClass} rows={3} value={draft.specs} onChange={(event) => setDraft((current) => ({ ...current, specs: event.target.value }))} /></label>
            <label className="block text-sm font-medium md:col-span-2">商品照片<input className={inputClass} accept="image/*" multiple type="file" onChange={(event) => setSingleImages(Array.from(event.target.files ?? []))} /></label>
            <label className="flex items-center gap-2 text-sm font-medium md:col-span-2"><input checked={draft.published} type="checkbox" onChange={(event) => setDraft((current) => ({ ...current, published: event.target.checked }))} />顯示於商品頁</label>
            <div className="md:col-span-2"><button className="rounded-full bg-[#605B51] px-6 py-3 text-sm font-medium text-[#F5F5F5] disabled:opacity-50" disabled={isBusy} type="submit">{isBusy ? "儲存中…" : "儲存商品"}</button>{message && <span className="ml-4 text-sm text-[#605B51]/75">{message}</span>}</div>
          </form>
        </section>
      </div>
    </main>
  );
}
