"use client";

import { useEffect, useState } from "react";

type DashboardView = "stock" | "create" | "orders" | "purchases" | "reports";
type Summary = { preorders: number; lowStock: number; pendingPurchases: number; monthlySales: number; shippedOrders: number; orderCount: number };

const emptySummary: Summary = { preorders: 0, lowStock: 0, pendingPurchases: 0, monthlySales: 0, shippedOrders: 0, orderCount: 0 };
const currency = (value: number) => `NT$ ${value.toLocaleString("zh-TW")}`;

export function Dashboard({ go }: { go: (view: DashboardView) => void }) {
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch("/api/dashboard");
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "無法讀取營運資料。");
        if (active) setSummary({ ...emptySummary, ...(result.summary ?? {}) });
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "無法讀取營運資料。");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadSummary();
    return () => { active = false; };
  }, []);

  const items: { count: number; title: string; note: string; action: string; target: DashboardView }[] = [
    { count: summary.preorders, title: "筆訂單預購中", note: "等待到貨與後續出貨處理", action: "查看訂單", target: "orders" },
    { count: summary.lowStock, title: "項商品庫存不足", note: "已低於或等於安全庫存，建議補貨", action: "查看庫存", target: "stock" },
    { count: summary.pendingPurchases, title: "張採購單待收貨", note: "收貨入庫後會同步增加可售庫存", action: "處理收貨", target: "purchases" },
  ];

  return <>
    <div className="mb-5 flex flex-wrap gap-2">
      <button onClick={() => go("stock")} className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E5E1DB] bg-white px-4 text-sm font-semibold text-[#58544D] hover:bg-[#FCFBF9]">查看庫存總覽</button>
      <button onClick={() => go("create")} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white hover:bg-[#46423D]">＋ 建立訂單</button>
    </div>
    {loadError && <p role="alert" className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] px-4 py-3 text-sm font-semibold text-[#9B562A]">{loadError}</p>}

    <section className="overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
      <div className="border-b border-[#F0EDE8] px-5 py-5 sm:px-6"><h1 className="text-lg font-semibold text-[#292824]">今日營運</h1></div>
      <div className="divide-y divide-[#F0EDE8]">{items.map((item) => <article key={item.title} className="flex items-center gap-3 px-5 py-4 sm:px-6"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F4EF] text-xs font-bold text-[#58715E]">{loading ? "—" : String(item.count).padStart(2, "0")}</span><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-[#48443E]">{item.title}</h2><p className="mt-1 truncate text-xs text-[#898379]">{item.note}</p></div><button onClick={() => go(item.target)} className="shrink-0 whitespace-nowrap text-sm font-semibold text-[#5E7665]">{item.action} →</button></article>)}</div>
    </section>

    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
      <div className="flex items-center justify-between border-b border-[#F0EDE8] px-5 py-5 sm:px-6"><h2 className="text-lg font-semibold text-[#292824]">報表中心大綱</h2><button onClick={() => go("reports")} className="text-sm font-semibold text-[#5E7665]">查看完整報表 →</button></div>
      <div className="grid divide-y divide-[#F0EDE8] sm:grid-cols-3 sm:divide-x sm:divide-y-0"><div className="p-5 sm:p-6"><p className="text-xs font-semibold text-[#807A72]">本月訂單總額</p><p className="mt-3 text-2xl font-semibold tracking-[-.05em] text-[#292824]">{loading ? "—" : currency(summary.monthlySales)}</p><p className="mt-2 text-xs text-[#8B847A]">不含已取消訂單</p></div><div className="p-5 sm:p-6"><p className="text-xs font-semibold text-[#807A72]">已出貨訂單</p><p className="mt-3 text-2xl font-semibold tracking-[-.05em] text-[#292824]">{loading ? "—" : `${summary.shippedOrders} 筆`}</p><p className="mt-2 text-xs text-[#8B847A]">目前共 {loading ? "—" : summary.orderCount} 筆訂單</p></div><div className="p-5 sm:p-6"><p className="text-xs font-semibold text-[#807A72]">低庫存商品</p><p className="mt-3 text-2xl font-semibold tracking-[-.05em] text-[#292824]">{loading ? "—" : `${summary.lowStock} 項`}</p><p className="mt-2 text-xs text-[#8B847A]">低於或等於安全庫存</p></div></div>
    </section>
  </>;
}
