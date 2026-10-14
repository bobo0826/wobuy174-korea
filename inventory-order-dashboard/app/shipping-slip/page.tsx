"use client";

import { useEffect, useState } from "react";

type SlipItem = {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  products?: { specification: string } | null;
};
type SlipOrder = {
  id: string;
  order_number: string;
  order_date: string;
  payment_method: string;
  reconciliation_status: string;
  delivery_method: string;
  delivery_fee: number;
  note: string;
  total: number;
  customers: { name: string; line_name: string; phone: string; address: string } | null;
  order_items: SlipItem[];
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const currency = (value: number) => `NT$ ${value.toLocaleString("zh-TW")}`;
const displayDate = (value: string) => value ? value.replaceAll("-", " / ") : "—";

function ShippingSlipSheet({ order, index }: { order: SlipOrder; index: number }) {
  const customer = order.customers;
  const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);

  return <section className={`shipping-slip-sheet min-h-[1123px] overflow-hidden rounded-2xl border border-[#726B62] bg-white print:rounded-none print:border-0 ${index ? "shipping-slip-sheet--next mt-8 print:mt-0" : ""}`}>
    <header className="flex items-start justify-between gap-4 border-b border-[#817A71] px-6 py-5">
      <div><p className="text-[11px] font-bold tracking-[.2em] text-[#5D574F]">wobuy174＿</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.04em]">商品出貨單</h2><p className="mt-1 text-sm text-[#4F4A43]">請隨包裹附上，並依商品明細完成檢貨。</p></div>
      <div className="grid w-[268px] shrink-0 grid-cols-2 gap-px overflow-hidden rounded-xl bg-[#716A61] text-center text-sm"><p className="flex h-[80px] flex-col items-center justify-center bg-[#F4F2EE] px-3"><span className="text-[11px] text-[#5C564F]">訂單編號</span><b className="mt-1 block text-[15px]">{order.order_number}</b></p><p className="flex h-[80px] flex-col items-center justify-center bg-[#F4F2EE] px-3"><span className="text-[11px] text-[#5C564F]">訂單日期</span><b className="mt-1 block text-[15px]">{displayDate(order.order_date)}</b></p></div>
    </header>

    <section className="grid gap-px border-b border-[#7D766D] bg-[#7D766D] sm:grid-cols-[1.25fr_.75fr_.9fr]">
      <div className="bg-white px-6 py-4"><p className="text-[11px] font-bold tracking-[.16em] text-[#5E5850]">收件人姓名</p><b className="mt-1 block text-2xl leading-tight tracking-[-.04em] text-[#1E1C19]">{customer?.name || "—"}</b><p className="mt-2 text-sm text-[#403C37]">LINE@：{customer?.line_name || "—"}</p></div>
      <div className="bg-[#F5F3EF] px-6 py-4"><p className="text-[11px] font-bold tracking-[.16em] text-[#5E5850]">付款狀態</p><b className="mt-1 block text-xl leading-tight text-[#1E1C19]">{order.reconciliation_status === "已付款" ? "已付款" : "需付款"}</b><p className="mt-2 text-sm text-[#403C37]">{order.payment_method}</p></div>
      <div className="bg-[#ECEAE5] px-6 py-4"><p className="text-[11px] font-bold tracking-[.16em] text-[#4D4841]">付款金額</p><b className="mt-1 block text-2xl leading-tight tracking-[-.04em] text-[#1E1C19]">{currency(order.total)}</b><p className="mt-2 text-sm text-[#403C37]">{order.reconciliation_status === "已付款" ? "已收款" : "請向客戶收款"}</p></div>
    </section>

    <section className="border-b border-[#817A71] px-6 py-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#5E5850]">DELIVERY</p><h3 className="mt-1 text-base font-semibold">收件與配送資訊</h3><div className="mt-3 grid grid-cols-2 gap-5 text-sm"><p><span className="block text-[11px] text-[#5E5850]">配送方式</span><b className="mt-1 block">{order.delivery_method}</b></p><p><span className="block text-[11px] text-[#5E5850]">配送地址</span><b className="mt-1 block leading-5">{customer?.address || "—"}</b></p></div><div className="mt-4 border-t border-[#AAA49B] pt-3 text-sm"><span className="text-[11px] font-bold tracking-[.12em] text-[#5E5850]">出貨備註　</span><b className="leading-5">{order.note || "—"}</b></div></section>

    <section className="shipping-slip-items px-6 py-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#5E5850]">ITEMS</p><h3 className="mt-1 text-base font-semibold">商品明細</h3></div><span className="rounded-full border border-[#8B847B] bg-[#F4F2EE] px-3 py-1 text-xs font-semibold text-[#292824]">共 {itemCount} 件</span></div><div className="overflow-hidden rounded-xl border border-[#777067]"><div className="grid grid-cols-[minmax(0,1fr)_72px_44px_80px] gap-2 bg-[#EEECE7] px-4 py-3 text-[11px] font-semibold text-[#4F4A43]"><span>商品名稱／規格</span><span className="text-right">售價</span><span className="text-right">數量</span><span className="text-right">總計</span></div>{order.order_items.map((item) => <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_72px_44px_80px] gap-2 border-t border-[#AAA49B] px-4 py-3.5 text-sm"><span><b className="block text-sm">{item.product_name}</b><small className="mt-1 block text-xs text-[#4F4A43]">{item.products?.specification || "—"}</small></span><b className="text-right text-xs">{currency(item.unit_price)}</b><b className="text-right text-sm">× {item.quantity}</b><b className="text-right text-xs">{currency(item.unit_price * item.quantity)}</b></div>)}<div className="flex items-center justify-end gap-5 border-t border-[#777067] bg-[#F4F2EE] px-4 py-3.5 text-sm">{order.delivery_method === "賣貨便" && <p className="text-[#403C37]">運費：{order.delivery_fee ? currency(order.delivery_fee) : "免運"}</p>}<p className="font-semibold">訂單總額：{currency(order.total)}</p></div></div></section>
  </section>;
}

export default function ShippingSlipPage() {
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const [orders, setOrders] = useState<SlipOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ids = Array.from(new Set([
      params.get("orderId") ?? "",
      ...(params.get("orderIds") ?? "").split(","),
    ].filter((id) => uuidPattern.test(id))));
    setRequestedIds(ids);
    if (!ids.length) { setLoading(false); return; }
    let active = true;
    const loadOrders = async () => {
      const results = await Promise.all(ids.map(async (id) => {
        try {
          const response = await fetch(`/api/orders/${encodeURIComponent(id)}`);
          const result = await response.json();
          if (!response.ok) throw new Error(result.message ?? "無法讀取訂單資料。");
          return { order: result.order as SlipOrder, error: "" };
        } catch (reason) {
          return { order: null, error: reason instanceof Error ? reason.message : "無法讀取訂單資料。" };
        }
      }));
      if (!active) return;
      setOrders(results.flatMap((result) => result.order ? [result.order] : []));
      const failed = results.filter((result) => result.error).length;
      if (failed) setError(`${failed} 張出貨單無法載入。`);
      setLoading(false);
    };
    void loadOrders();
    return () => { active = false; };
  }, []);

  if (loading) return <main className="shipping-slip-page flex min-h-screen items-center justify-center bg-[#F8F7F4] px-5 text-[#6F6960]"><p className="rounded-xl border border-[#E9E5DF] bg-white px-5 py-4 text-sm font-semibold">正在載入出貨單…</p></main>;
  if (!requestedIds.length || !orders.length) return <main className="shipping-slip-page flex min-h-screen items-center justify-center bg-[#F8F7F4] px-5 text-[#292824]"><div className="max-w-md rounded-2xl border border-[#E9E5DF] bg-white p-6"><p className="text-[11px] font-bold tracking-[.18em] text-[#A09A90]">SHIPPING SLIP</p><h1 className="mt-2 text-xl font-semibold">尚未選擇訂單</h1><p className="mt-3 text-sm leading-6 text-[#746E65]">{error || "請從訂單管理的訂單詳情按下「列印出貨單」。"}</p><a href="/" className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white">返回系統</a></div></main>;

  const batch = orders.length > 1;
  return <main className="shipping-slip-page min-h-screen bg-[#F8F7F4] px-5 py-8 text-[#292824] sm:px-8 sm:py-12 print:bg-white print:p-0">
    <div className="shipping-slip-shell mx-auto w-full max-w-[794px]">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden"><div><p className="text-[11px] font-bold tracking-[.18em] text-[#A09A90]">SHIPPING SLIP</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.05em]">{batch ? "批量出貨單列印" : "出貨單列印"}</h1><p className="mt-2 text-sm text-[#7B766E]">{batch ? `已選擇 ${orders.length} 張出貨單，列印時會每張各自使用一頁 A4。` : "確認收件與商品內容後，即可列印出貨單。"}</p></div><div className="flex gap-2"><a href="/" className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E5E1DB] bg-white px-4 text-sm font-semibold text-[#58544D]">返回系統</a><button onClick={() => window.print()} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white">{batch ? `列印 ${orders.length} 張出貨單` : "列印出貨單"}</button></div></div>
      {error && <p className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] px-4 py-3 text-sm font-semibold text-[#9B562A] print:hidden">{error}</p>}
      {orders.map((order, index) => <ShippingSlipSheet key={order.id} order={order} index={index} />)}
    </div>
  </main>;
}
