"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";

const categoryFilters = [
  { id: "all", label: "全部商品" },
  { id: "popular", label: "熱門商品" },
  { id: "bedding", label: "韓國棉被" },
  { id: "korea", label: "韓國選品" },
  { id: "japan", label: "日本選品" },
  { id: "other", label: "其他選品" },
] as const;

type CategoryFilter = (typeof categoryFilters)[number]["id"];

const beddingTypeFilters = [
  { id: "all", label: "全部" },
  { id: "cool", label: "涼感被" },
  { id: "allSeason", label: "四季被" },
  { id: "pillow", label: "秒睡枕" },
] as const;

type BeddingTypeFilter = (typeof beddingTypeFilters)[number]["id"];

type ManagedProduct = {
  id: string;
  code: string;
  name: string;
  price: string;
  status: string;
  sort_order: number | null;
  categories: string[] | null;
  bedding_type: string | null;
  variants: unknown;
  image_urls: string[] | null;
  published: boolean;
};

function storagePathsFromUrls(imageUrls: string[]) {
  return imageUrls
    .map((url) => {
      const marker = "/product-images/";
      const index = url.indexOf(marker);
      return index === -1 ? "" : decodeURIComponent(url.slice(index + marker.length));
    })
    .filter(Boolean);
}

function variantCount(value: unknown) {
  if (!Array.isArray(value)) return 0;
  return value.filter((variant) => {
    if (!variant || typeof variant !== "object") return false;
    const record = variant as Record<string, unknown>;
    return typeof record.name === "string" && Boolean(record.name.trim()) && typeof record.price === "string" && Boolean(record.price.trim());
  }).length;
}

export default function AdminProductsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [activeBeddingType, setActiveBeddingType] = useState<BeddingTypeFilter>("all");
  const [sortValues, setSortValues] = useState<Record<string, string>>({});
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadProducts = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      const schemaHint = error.message.includes("sort_order")
        ? "請先在 Supabase SQL Editor 重新執行 supabase/schema.sql。"
        : "";
      setMessage(`讀取商品失敗：${error.message} ${schemaHint}`);
      return;
    }

    const loadedProducts = (data ?? []) as ManagedProduct[];
    setProducts(loadedProducts);
    setSortValues(
      Object.fromEntries(loadedProducts.map((product) => [product.id, String(product.sort_order ?? 0)])),
    );
    setMessage("");
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) void loadProducts();
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void loadProducts();
      } else {
        setProducts([]);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [loadProducts]);

  const togglePublished = async (product: ManagedProduct) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setIsBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("products")
      .update({ published: !product.published })
      .eq("id", product.id);

    if (error) {
      setMessage(`更新顯示狀態失敗：${error.message}`);
    } else {
      await loadProducts();
    }
    setIsBusy(false);
  };

  const deleteProduct = async (product: ManagedProduct) => {
    if (!window.confirm(`確定要刪除「${product.name}」嗎？此操作無法復原。`)) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    setIsBusy(true);
    setMessage("");
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      setMessage(`刪除失敗：${error.message}`);
      setIsBusy(false);
      return;
    }

    const imagePaths = storagePathsFromUrls(product.image_urls ?? []);
    if (imagePaths.length) await supabase.storage.from("product-images").remove(imagePaths);
    await loadProducts();
    setIsBusy(false);
  };

  const saveSortOrder = async (product: ManagedProduct) => {
    const rawValue = sortValues[product.id] ?? String(product.sort_order ?? 0);
    const nextSortOrder = Number(rawValue);
    if (!Number.isInteger(nextSortOrder) || nextSortOrder < 0) {
      setMessage("排序請填寫 0 以上的整數。");
      setSortValues((current) => ({ ...current, [product.id]: String(product.sort_order ?? 0) }));
      return;
    }
    if (nextSortOrder === (product.sort_order ?? 0)) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    setIsBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("products")
      .update({ sort_order: nextSortOrder })
      .eq("id", product.id);
    if (error) {
      setMessage(`調整排序失敗：${error.message}`);
    } else {
      await loadProducts();
    }
    setIsBusy(false);
  };

  const visibleProducts = products.filter((product) => {
    const categoryMatches = activeCategory === "all" || product.categories?.includes(activeCategory);
    const beddingTypeMatches =
      activeCategory !== "bedding" ||
      activeBeddingType === "all" ||
      product.bedding_type === activeBeddingType;

    return categoryMatches && beddingTypeMatches;
  });

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen bg-[#F5F5F5] px-5 py-12 text-[#605B51] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-xl rounded-[6px] border border-[#D9D6D0] bg-[#EAE8E4] p-7">
          <h1 className="text-2xl font-semibold">請先連接商品資料庫</h1>
          <Link className="mt-6 inline-flex rounded-full bg-[#605B51] px-5 py-3 text-sm font-medium text-[#F5F5F5]" href="/admin">回到後台</Link>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#F5F5F5] px-5 py-12 text-[#605B51] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-xl rounded-[6px] border border-[#D9D6D0] bg-[#EAE8E4] p-7">
          <h1 className="text-2xl font-semibold">請先登入商品後台</h1>
          <p className="mt-3 text-sm leading-6 text-[#605B51]/70">登入狀態會自動帶入這個商品列表頁面。</p>
          <Link className="mt-6 inline-flex rounded-full bg-[#605B51] px-5 py-3 text-sm font-medium text-[#F5F5F5]" href="/admin">前往登入</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F5F5] pb-16 text-[#605B51]">
      <header className="border-b border-[#D9D6D0] px-5 py-5 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
          <div><p className="text-lg font-semibold tracking-[0.1em]">信男代購</p><p className="mt-1 text-[10px] tracking-[0.2em] text-[#605B51]/65">WOBUY174_ / PRODUCTS</p></div>
          <div className="flex items-center gap-3 text-sm"><Link className="rounded-full border border-[#D9D6D0] px-4 py-2 hover:border-[#605B51]" href="/admin#single-product-form">新增商品</Link><Link className="border-b border-[#605B51] pb-1" href="/admin">回後台</Link></div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8 sm:py-12 lg:px-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.22em] text-[#605B51]/65">PRODUCT LIST</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">商品列表</h1>
          </div>
          <button className="rounded-full border border-[#D9D6D0] px-4 py-2 text-sm transition-colors hover:border-[#605B51]" disabled={isBusy} onClick={() => void loadProducts()}>重新整理</button>
        </div>

        <div className="mt-7 border-y border-[#D9D6D0] py-5">
          <p className="text-sm font-semibold">分類篩選</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {categoryFilters.map((filter) => {
              const count = filter.id === "all" ? products.length : products.filter((product) => product.categories?.includes(filter.id)).length;
              const selected = activeCategory === filter.id;
              return <button aria-pressed={selected} className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${selected ? "border-[#605B51] bg-[#605B51] text-[#F5F5F5]" : "border-[#D9D6D0] hover:border-[#605B51]"}`} key={filter.id} onClick={() => { setActiveCategory(filter.id); setActiveBeddingType("all"); }}>{filter.label} <span className="ml-1 text-xs opacity-70">{count}</span></button>;
            })}
          </div>
          {activeCategory === "bedding" && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-[#D9D6D0] pt-3">
              {beddingTypeFilters.map((filter) => {
                const count = filter.id === "all"
                  ? products.filter((product) => product.categories?.includes("bedding")).length
                  : products.filter((product) => product.categories?.includes("bedding") && product.bedding_type === filter.id).length;
                const selected = activeBeddingType === filter.id;
                return <button aria-pressed={selected} className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${selected ? "border-[#7D2F35] bg-[#7D2F35] text-[#F5F5F5]" : "border-[#D9D6D0] hover:border-[#7D2F35]"}`} key={filter.id} onClick={() => setActiveBeddingType(filter.id)}>{filter.label} <span className="ml-1 text-xs opacity-70">{count}</span></button>;
              })}
            </div>
          )}
        </div>

        {message && <p className="mt-5 text-sm leading-6 text-[#A81515]">{message}</p>}
        {!message && !visibleProducts.length && <p className="mt-8 text-sm leading-7 text-[#605B51]/65">這個分類目前沒有商品。</p>}
        <p className="mt-5 text-sm leading-6 text-[#605B51]/65">排序會影響全部商品的前台順序；數字越小越前面。</p>

        <div className="mt-6 overflow-x-auto rounded-[5px] border border-[#D9D6D0] bg-[#F5F5F5]">
          <table className="min-w-[940px] w-full text-left text-sm">
            <thead className="border-b border-[#D9D6D0] bg-[#EAE8E4] text-xs font-semibold tracking-[0.08em] text-[#605B51]/70">
              <tr>
                <th className="w-24 px-4 py-3">排序</th>
                <th className="min-w-80 px-4 py-3">商品</th>
                <th className="min-w-36 px-4 py-3">分類</th>
                <th className="w-24 px-4 py-3">貨況</th>
                <th className="w-28 px-4 py-3">前台顯示</th>
                <th className="w-36 px-4 py-3 text-right">管理</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D6D0]">
              {visibleProducts.map((product) => {
                const labels: string[] = categoryFilters
                  .filter((filter) => filter.id !== "all" && product.categories?.includes(filter.id))
                  .map((filter) => filter.label);
                const beddingTypeLabel = beddingTypeFilters.find((filter) => filter.id === product.bedding_type)?.label;
                if (beddingTypeLabel) labels.push(beddingTypeLabel);
                const productVariantCount = variantCount(product.variants);
                return (
                  <tr className="align-middle" key={product.id}>
                    <td className="px-4 py-3">
                      <input aria-label={`${product.name} 的排序`} className="w-16 rounded border border-[#D9D6D0] bg-[#F5F5F5] px-2 py-1.5 text-center text-sm outline-none focus:border-[#605B51]" disabled={isBusy} inputMode="numeric" min="0" onBlur={() => void saveSortOrder(product)} onChange={(event) => setSortValues((current) => ({ ...current, [product.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} type="number" value={sortValues[product.id] ?? String(product.sort_order ?? 0)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-14 w-14 shrink-0 rounded-[3px] bg-[#EAE8E4] bg-cover bg-center" style={{ backgroundImage: product.image_urls?.[0] ? `url(${product.image_urls[0]})` : undefined }} />
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium tracking-[0.1em] text-[#605B51]/65">{product.code}</p>
                          <p className="mt-1 line-clamp-1 font-semibold">{product.name}</p>
                          <p className="mt-1 font-semibold text-[#A81515]">NT$ {product.price.replace(/^NT\$\s*/i, "")}{productVariantCount ? <span className="ml-0.5 text-xs font-medium">起</span> : null}</p>
                          {productVariantCount ? <p className="mt-1 text-[11px] text-[#605B51]/65">{productVariantCount} 種子分類規格</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs leading-5 text-[#605B51]/75">{labels.length ? labels.join(" · ") : "未分類"}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${product.status === "現貨" ? "bg-[#7D2F35] text-[#F5F5F5]" : "bg-[#E9E7E3] text-[#605B51]"}`}>{product.status}</span></td>
                    <td className="px-4 py-3"><button aria-pressed={product.published} className={`rounded-full px-2.5 py-1.5 text-xs font-semibold ${product.published ? "bg-[#605B51] text-[#F5F5F5]" : "border border-[#D9D6D0] text-[#605B51]"}`} disabled={isBusy} onClick={() => void togglePublished(product)}>{product.published ? "顯示中" : "已隱藏"}</button></td>
                    <td className="px-4 py-3 text-right"><div className="inline-flex items-center gap-3"><Link className="font-medium hover:text-[#766F63]" href={`/admin?edit=${encodeURIComponent(product.code)}#single-product-form`}>編輯</Link><button className="font-medium text-[#A81515] disabled:opacity-50" disabled={isBusy} onClick={() => void deleteProduct(product)}>刪除</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
