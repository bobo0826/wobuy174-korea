"use client";

import { useEffect, useState } from "react";

type OrderItem = { id: string; name: string; specification: string; unitPrice: number; quantity: number };
type Order = {
  id: string;
  number: string;
  createdAt: string;
  customer: string;
  lineName: string;
  phone: string;
  address: string;
  payment: string;
  paymentStatus: "已付款" | "未付款";
  delivery: string;
  status: "預購中" | "已到貨" | "已出貨" | "已取消";
  statusTone: Tone;
  stockStatus: string;
  items: OrderItem[];
  shipping: number;
  note: string;
};
type Tone = "green" | "orange" | "blue" | "stone";
type StoredOrder = {
  id: string; order_number: string; order_date: string; status: Order["status"]; order_method: string;
  payment_method: string; reconciliation_status: string; delivery_method: string; delivery_fee: number; note: string;
  customers: { name: string; line_name: string; phone: string; address: string } | null;
  order_items: Array<{ id: string; product_name: string; category: string; unit_price: number; quantity: number }>;
};

const currency = (value: number) => `NT$ ${value.toLocaleString("zh-TW")}`;
const tones: Record<Tone, string> = { green: "bg-[#E7F0E8] text-[#477154]", orange: "bg-[#FAECDD] text-[#A66932]", blue: "bg-[#E5EEF2] text-[#4B6D79]", stone: "bg-[#F0EDE8] text-[#6F6960]" };
const statusTone = (status: Order["status"]): Tone => status === "預購中" ? "orange" : status === "已到貨" ? "blue" : status === "已出貨" ? "green" : "stone";
const toOrder = (record: StoredOrder): Order => ({
  id: record.id,
  number: record.order_number,
  createdAt: record.order_date.replaceAll("-", "."),
  customer: record.customers?.name || "未指定客戶",
  lineName: record.customers?.line_name || "—",
  phone: record.customers?.phone || "—",
  address: record.customers?.address || "—",
  payment: record.payment_method,
  paymentStatus: record.reconciliation_status === "已付款" ? "已付款" : "未付款",
  delivery: record.delivery_method,
  status: record.status,
  statusTone: statusTone(record.status),
  stockStatus: record.status === "已出貨" ? "庫存已扣除" : record.status === "已取消" ? "未扣除庫存" : "尚未扣除",
  items: record.order_items.map((item) => ({ id: item.id, name: item.product_name, specification: item.category, unitPrice: item.unit_price, quantity: item.quantity })),
  shipping: record.delivery_fee,
  note: record.note || "—",
});

function Pill({ children, tone }: { children: React.ReactNode; tone: Tone }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function OrderDetail({ order, back, onUpdated, onDeleted, onInventoryChanged }: { order: Order; back: () => void; onUpdated: (order: Order) => void; onDeleted: (id: string) => void; onInventoryChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ status: order.status, paymentMethod: order.payment, paymentStatus: order.paymentStatus, deliveryMethod: order.delivery, note: order.note === "—" ? "" : order.note });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const subtotal = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const total = subtotal + order.shipping;
  const fields = [["客戶姓名", order.customer], ["LINE@名稱", order.lineName], ["電話", order.phone], ["地址", order.address]];
  const openEditor = () => { setForm({ status: order.status, paymentMethod: order.payment, paymentStatus: order.paymentStatus, deliveryMethod: order.delivery, note: order.note === "—" ? "" : order.note }); setError(""); setEditing(true); };
  const saveOrder = async () => {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", ...form }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法更新訂單。");
      onUpdated(toOrder(result.order as StoredOrder));
      setEditing(false);
      await onInventoryChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法更新訂單。"); }
    finally { setSaving(false); }
  };
  const removeOrder = async () => {
    if (!window.confirm(`確定要刪除訂單「${order.number}」嗎？\n已出貨的訂單會自動回補商品庫存。`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法刪除訂單。");
      onDeleted(order.id);
      await onInventoryChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法刪除訂單。"); }
    finally { setSaving(false); }
  };

  return <>
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><button onClick={back} className="text-sm font-semibold text-[#5E7665]">← 返回訂單管理</button><p className="mt-5 text-[11px] font-bold tracking-[.18em] text-[#A09A90]">ORDER DETAIL</p><h1 className="mt-2 text-[29px] font-semibold tracking-[-.055em] text-[#292824] sm:text-[33px]">訂單 {order.number}</h1><p className="mt-2 text-sm text-[#7B766E]">建立於 {order.createdAt}</p></div><div className="flex flex-wrap items-center gap-2"><Pill tone={order.statusTone}>{order.status}</Pill><Pill tone={order.paymentStatus === "已付款" ? "green" : "orange"}>{order.paymentStatus}</Pill><button onClick={openEditor} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665]">修改訂單</button><button onClick={() => { void removeOrder(); }} disabled={saving} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#F0D6C2] bg-white px-3 text-sm font-semibold text-[#A35F37] disabled:opacity-50">刪除訂單</button></div></div>
    {error && <p role="alert" className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] px-4 py-3 text-sm font-semibold text-[#9B562A]">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><div className="space-y-5"><section className="overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white"><div className="border-b border-[#F0EDE8] px-5 py-5 sm:px-6"><h2 className="text-lg font-semibold">訂購商品</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">商品</th><th className="px-3 py-3">單價</th><th className="px-3 py-3">數量</th><th className="px-6 py-3 text-right">小計</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{order.items.map((item) => <tr key={item.id}><td className="px-6 py-4"><b className="block text-[#4A4640]">{item.name}</b><small className="mt-1 block text-xs text-[#938D84]">{item.specification}</small></td><td className="px-3 py-4 text-[#625D55]">{currency(item.unitPrice)}</td><td className="px-3 py-4 text-[#625D55]">{item.quantity}</td><td className="px-6 py-4 text-right font-semibold text-[#4A4640]">{currency(item.unitPrice * item.quantity)}</td></tr>)}</tbody></table></div></section><section className="rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">INTERNAL NOTE</p><h2 className="mt-1 text-lg font-semibold">訂單備註</h2><p className="mt-4 rounded-xl bg-[#F8F6F2] p-4 text-sm leading-6 text-[#706A61]">{order.note}</p></section></div><aside className="space-y-5"><section className="rounded-2xl border border-[#E9E5DF] bg-white p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">ORDER SUMMARY</p><h2 className="mt-1 text-lg font-semibold">訂單摘要</h2><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between text-[#777168]"><span>商品小計</span><span>{currency(subtotal)}</span></div>{order.delivery === "賣貨便" && <div className="flex justify-between text-[#777168]"><span>賣貨便運費</span><span>{order.shipping ? currency(order.shipping) : "免運"}</span></div>}<div className="flex justify-between border-t border-[#F0EDE8] pt-4 text-base font-semibold text-[#292824]"><span>訂單總額</span><span>{currency(total)}</span></div></div><div className="mt-5 rounded-xl bg-[#EEF5EF] p-4"><p className="text-xs font-semibold text-[#41634A]">{order.stockStatus}</p><p className="mt-1 text-xs leading-5 text-[#6F806F]">已出貨訂單刪除時，系統會自動新增回補紀錄。</p></div></section><section className="rounded-2xl border border-[#E9E5DF] bg-white p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PAYMENT & DELIVERY</p><h2 className="mt-1 text-lg font-semibold">付款與配送</h2><div className="mt-5 grid gap-4 text-sm"><div><p className="text-xs text-[#938D84]">付款方式</p><p className="mt-1 font-semibold text-[#48433C]">{order.payment}</p></div><div><p className="text-xs text-[#938D84]">付款狀態</p><p className="mt-1 font-semibold text-[#48433C]">{order.paymentStatus}</p></div><div><p className="text-xs text-[#938D84]">配送方式</p><p className="mt-1 font-semibold text-[#48433C]">{order.delivery}</p></div></div></section><section className="rounded-2xl border border-[#E9E5DF] bg-white p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CUSTOMER</p><h2 className="mt-1 text-lg font-semibold">客戶資料</h2><div className="mt-5 grid gap-4 text-sm">{fields.map(([label, value]) => <div key={label}><p className="text-xs text-[#938D84]">{label}</p><p className="mt-1 break-words font-semibold leading-6 text-[#48433C]">{value}</p></div>)}</div></section></aside></div>
    {editing && <div className="fixed inset-0 z-50 flex items-end bg-[#292824]/35 sm:items-center sm:justify-center sm:p-6"><div role="dialog" aria-modal="true" aria-labelledby="edit-order-title" className="w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">EDIT ORDER</p><h2 id="edit-order-title" className="mt-2 text-xl font-semibold">修改訂單</h2><p className="mt-2 text-sm text-[#7D776E]">可更新訂單狀態、付款、配送與備註。改為已出貨時，系統會立即扣除庫存。</p></div><button aria-label="關閉修改訂單視窗" onClick={() => setEditing(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg text-[#777168]">×</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#58534C]">訂單狀態<select value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value as Order["status"] }))} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"><option>預購中</option><option>已到貨</option><option>已出貨</option></select></label><label className="text-sm font-semibold text-[#58534C]">付款方式<select value={form.paymentMethod} onChange={(event) => setForm((previous) => ({ ...previous, paymentMethod: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"><option>銀行轉帳</option><option>信用卡</option><option>現金</option></select></label><label className="text-sm font-semibold text-[#58534C]">付款狀態<select value={form.paymentStatus} onChange={(event) => setForm((previous) => ({ ...previous, paymentStatus: event.target.value as Order["paymentStatus"] }))} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"><option>未付款</option><option>已付款</option></select></label><label className="text-sm font-semibold text-[#58534C]">配送方式<select value={form.deliveryMethod} onChange={(event) => setForm((previous) => ({ ...previous, deliveryMethod: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"><option>門市自取</option><option>賣貨便</option></select></label><label className="text-sm font-semibold text-[#58534C] sm:col-span-2">備註<textarea value={form.note} onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))} className="mt-2 min-h-24 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] p-3 text-sm font-normal outline-none" /></label></div>{error && <p role="alert" className="mt-4 text-sm font-semibold text-[#A35F37]">{error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={() => setEditing(false)} disabled={saving} className="inline-flex h-11 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-4 text-sm font-semibold text-[#625D55]">取消</button><button onClick={() => { void saveOrder(); }} disabled={saving} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white disabled:opacity-55">{saving ? "儲存中…" : "儲存修改"}</button></div></div></div>}
  </>;
}

export function Orders({ created, go, onInventoryChanged }: { created: boolean; go: (view: "create") => void; onInventoryChanged: () => Promise<void> }) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("全部狀態");
  const [storedOrders, setStoredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    const loadOrders = async () => { setLoading(true); setLoadError(""); try { const response = await fetch("/api/orders"); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "無法讀取訂單資料。"); if (active) setStoredOrders((result.orders ?? []).map((order: StoredOrder) => toOrder(order))); } catch (reason) { if (active) setLoadError(reason instanceof Error ? reason.message : "無法讀取訂單資料。"); } finally { if (active) setLoading(false); } };
    void loadOrders(); return () => { active = false; };
  }, [created]);
  const statuses = ["全部狀態", "預購中", "已到貨", "已出貨", "已取消"];
  const visibleOrders = storedOrders.filter((order) => (statusFilter === "全部狀態" || order.status === statusFilter) && (!query.trim() || [order.number, order.customer, order.lineName, ...order.items.map((item) => item.name)].join(" ").toLowerCase().includes(query.trim().toLowerCase())));
  const updateOrder = (updated: Order) => { setStoredOrders((previous) => previous.map((order) => order.id === updated.id ? updated : order)); setSelectedOrder(updated); };
  const deleteOrder = (id: string) => { setStoredOrders((previous) => previous.filter((order) => order.id !== id)); setSelectedOrder(null); };
  if (selectedOrder) return <OrderDetail order={selectedOrder} back={() => setSelectedOrder(null)} onUpdated={updateOrder} onDeleted={deleteOrder} onInventoryChanged={onInventoryChanged} />;

  return <><div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold tracking-[.18em] text-[#A09A90]">ORDERS</p><h1 className="mt-2 text-[29px] font-semibold tracking-[-.055em] text-[#292824] sm:text-[33px]">訂單管理</h1><p className="mt-2 text-sm text-[#7B766E]">管理訂單狀態、付款與配送資料；已出貨訂單可安全刪除並自動回補庫存。</p></div><button onClick={() => go("create")} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white hover:bg-[#46423D]">＋ 建立訂單</button></div>{loadError && <p role="alert" className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] px-4 py-3 text-sm font-semibold text-[#9B562A]">{loadError}</p>}<section className="overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white"><div className="flex flex-col gap-4 border-b border-[#F0EDE8] p-5 sm:p-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><label className="flex h-11 max-w-md flex-1 items-center gap-2 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#928C84]"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#AAA39A]" placeholder="搜尋訂單編號、客戶姓名或商品" /></label><span className="text-xs text-[#807A71]">顯示 {visibleOrders.length} 筆訂單</span></div><div className="flex gap-2 overflow-x-auto">{statuses.map((status) => <button key={status} onClick={() => setStatusFilter(status)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${statusFilter === status ? "bg-[#292824] text-white" : "bg-[#F4F1ED] text-[#706A61]"}`}>{status}</button>)}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">訂單編號</th><th className="px-3 py-3">建立日期</th><th className="px-3 py-3">客戶</th><th className="px-3 py-3">商品</th><th className="px-3 py-3">金額</th><th className="px-3 py-3">付款狀態</th><th className="px-3 py-3">訂單狀態</th><th className="px-3 py-3">庫存狀態</th><th className="px-6 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{loading ? <tr><td colSpan={9} className="px-6 py-10 text-center text-[#8D877E]">載入訂單資料中…</td></tr> : visibleOrders.length ? visibleOrders.map((order) => { const total = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) + order.shipping; const count = order.items.reduce((sum, item) => sum + item.quantity, 0); return <tr key={order.id} onClick={() => setSelectedOrder(order)} className="cursor-pointer hover:bg-[#FCFBF9]"><td className="px-6 py-4 font-semibold text-[#4A4640]">{order.number}</td><td className="px-3 py-4 text-[#777168]">{order.createdAt}</td><td className="px-3 py-4 text-[#5C574F]">{order.customer}</td><td className="px-3 py-4">{count} 項</td><td className="px-3 py-4 font-medium">{currency(total)}</td><td className="px-3 py-4"><Pill tone={order.paymentStatus === "已付款" ? "green" : "orange"}>{order.paymentStatus}</Pill></td><td className="px-3 py-4"><Pill tone={order.statusTone}>{order.status}</Pill></td><td className="px-3 py-4"><Pill tone={order.status === "已出貨" ? "green" : "stone"}>{order.stockStatus}</Pill></td><td className="px-6 py-4 text-right"><button onClick={(event) => { event.stopPropagation(); setSelectedOrder(order); }} className="text-sm font-semibold text-[#5E7665]">查看／修改 →</button></td></tr>; }) : <tr><td colSpan={9} className="px-6 py-10 text-center text-[#8D877E]">找不到符合條件的訂單。</td></tr>}</tbody></table></div></section></>;
}
