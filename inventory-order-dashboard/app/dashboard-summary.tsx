"use client";

import { useEffect, useState } from "react";

type DashboardView = "stock" | "create" | "orders" | "purchases" | "reports";
type OrderRow = { order_date: string; status: string; total: number };
type ProductRow = { available_stock: number; safety_stock: number };
type PurchaseRow = { status: string };
type Summary = { preorders: number; lowStock: number; pendingPurchases: number; monthlySales: number; shippedOrders: number; orderCount: number };

const emptySummary: Summary = { preorders: 0, lowStock: 0, pendingPurchases: 0, monthlySales: 0, shippedOrders: 0, orderCount: 0 };
const currency = (value: number) => `NT$ ${value.toLocaleString("zh-TW")}`;
const currentMonth = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}`;
};

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
        const [ordersResponse, productsResponse, purchasesResponse] = await Promise.all([fetch("/api/orders"), fetch("/api/products"), fetch("/api/purchase-orders")]);
        const [ordersResult, productsResult, purchasesResult] = await Promise.all([ordersResponse.json(), productsResponse.json(), purchasesResponse.json()]);
        if (!ordersResponse.ok || !productsResponse.ok || !purchasesResponse.ok) throw new Error("無法讀取營運資料。");
        const orders = (ordersResult.orders ?? []) as OrderRow[];
        const products = (productsResult.products ?? []) as ProductRow[];
        const purchases = (purchasesResult.purchaseOrders ?? []) as PurchaseRow[];
        const month = currentMonth();
        if (active) setSummary({
          preorders: orders.filter((order) => order.status === "預購中").length,
          lowStock: products.filter((product) => product.available_stock <= product.safety_stock).length,
          pendingPurchases: purchases.filter((purchase) => purchase.status !== "已完成" && purchase.status !== "已取消").length,
          monthlySales: orders.filter((order) => order.order_date.startsWith(month) && order.status !== "已取消").reduce((sum, order) => sum + (Number(order.total) || 0), 0),
          shippedOrders: orders.filter((order) => order.status === "已出貨").length,
          orderCount: orders.length,
        });
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
