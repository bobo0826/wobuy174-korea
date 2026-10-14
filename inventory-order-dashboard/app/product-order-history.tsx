"use client";

import { useEffect, useMemo, useState } from "react";

type RelatedOrder = {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  customer_name: string;
  quantity: number;
};

const statuses = new Set(["預購中", "未出貨", "已出貨", "已取消"]);

export function ProductOrderHistory({ productId, productName, open, onClose, onOpenOrder }: {
  productId: string | number;
  productName: string;
  open: boolean;
  onClose: () => void;
  onOpenOrder: (id: string) => void;
}) {
  const [orders, setOrders] = useState<RelatedOrder[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (typeof productId !== "string") {
      setOrders([]);
      setSelectedIds([]);
      setError("這項商品尚未儲存至資料庫，因此沒有可查詢的訂單。 ");
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      setSelectedIds([]);
      try {
        const response = await fetch(`/api/products/${encodeURIComponent(productId)}/orders`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "無法讀取商品訂單。 ");
        if (active) setOrders(result.orders ?? []);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "無法讀取商品訂單。 ");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [open, productId]);

  const selectable = useMemo(() => orders.filter((order) => order.status !== "已取消"), [orders]);
  const allSelected = Boolean(selectable.length) && selectable.every((order) => selectedIds.includes(order.id));
  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const toggleAll = () => setSelectedIds(allSelected ? [] : selectable.map((order) => order.id));
  const print = () => {
    const ids = selectable.filter((order) => selectedIds.includes(order.id)).map((order) => order.id);
    if (!ids.length) return;
    window.open(`/shipping-slip?${new URLSearchParams({ orderIds: ids.join(",") }).toString()}`, "_blank", "noopener,noreferrer");
  };
  const tone = (status: string) => status === "已出貨" ? "bg-[#E7F0E8] text-[#477154]" : status === "預購中" ? "bg-[#FAECDD] text-[#A66932]" : status === "未出貨" ? "bg-[#E5EEF2] text-[#4B6D79]" : "bg-[#F0EDE8] text-[#6F6960]";

  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end bg-[#292824]/35 sm:items-center sm:justify-center sm:p-6">
    <div role="dialog" aria-modal="true" aria-labelledby="product-orders-title" className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
      <div className="flex items-start justify-between gap-4 border-b border-[#F0EDE8] p-5 sm:p-6">
        <div>
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PURCHASED IN ORDERS</p>
          <h2 id="product-orders-title" className="mt-1 text-xl font-semibold">購買此商品的訂單</h2>
          <p className="mt-2 text-sm text-[#7D776E]">{productName}</p>
        </div>
        <button aria-label="關閉購買訂單" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg text-[#777168]">×</button>
      </div>
      {error && <p role="alert" className="mx-5 mt-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] px-4 py-3 text-sm font-semibold text-[#9B562A] sm:mx-6">{error}</p>}
      <div className="max-h-[calc(88vh-220px)] overflow-auto">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="sticky top-0 bg-[#FBFAF8] text-[11px] text-[#928C83]"><tr><th className="w-12 px-5 py-3 sm:px-6"><input aria-label="選取全部可列印訂單" type="checkbox" checked={allSelected} onChange={toggleAll} /></th><th className="px-3 py-3">訂單編號</th><th className="px-3 py-3">訂購者姓名</th><th className="px-3 py-3">訂購日期</th><th className="px-3 py-3">數量</th><th className="px-3 py-3">狀態</th><th className="px-5 py-3 text-right sm:px-6">操作</th></tr></thead>
            <tbody className="divide-y divide-[#F0EDE8]">{loading ? <tr><td colSpan={7} className="px-6 py-12 text-center text-[#8D877E]">載入相關訂單中…</td></tr> : orders.length ? orders.map((order) => <tr key={order.id} className="hover:bg-[#FCFBF9]"><td className="px-5 py-4 sm:px-6">{order.status !== "已取消" && <input aria-label={`選取訂單 ${order.order_number}`} type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => toggle(order.id)} />}</td><td className="px-3 py-4 font-semibold text-[#4A4640]">{order.order_number}</td><td className="px-3 py-4 text-[#625D55]">{order.customer_name}</td><td className="px-3 py-4 text-[#625D55]">{order.order_date}</td><td className="px-3 py-4 text-[#625D55]">{order.quantity} 件</td><td className="px-3 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone(order.status)}`}>{statuses.has(order.status) ? order.status : "—"}</span></td><td className="px-5 py-4 text-right sm:px-6"><button onClick={() => onOpenOrder(order.id)} className="text-sm font-semibold text-[#5E7665]">查看訂單詳情 →</button></td></tr>) : <tr><td colSpan={7} className="px-6 py-12 text-center text-[#8D877E]">尚無包含此商品的訂單。</td></tr>}</tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-[#F0EDE8] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><p className="text-xs leading-5 text-[#827B72]">已取消訂單不會列入批量列印。</p><div className="flex flex-col-reverse gap-2 sm:flex-row"><button onClick={onClose} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665]">關閉</button><button onClick={print} disabled={!selectedIds.length} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">批量列印出貨單</button></div></div>
    </div>
  </div>;
}
