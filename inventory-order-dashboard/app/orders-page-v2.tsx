"use client";

import { useEffect, useMemo, useState } from "react";
import { OrderEditor } from "./order-editor-v3";

type Tone = "green" | "orange" | "blue" | "stone";
type Customer = { id: string; name: string; line_name: string; phone: string; address: string };
type StoredItem = {
  id: string;
  product_id: string;
  product_name: string;
  category: string;
  unit_price: number;
  unit_cost: number;
  quantity: number;
  products?: { specification: string } | null;
};
type StoredOrder = {
  id: string;
  order_number: string;
  order_date: string;
  status: "預購中" | "未出貨" | "已出貨" | "已取消";
  order_method: string;
  payment_method: string;
  reconciliation_status: string;
  delivery_method: string;
  delivery_fee: number;
  note: string;
  customers: Customer | null;
  order_items: StoredItem[];
};
type BulkAction = "arrive" | "complete";

const currency = (value: number) => `NT$ ${value.toLocaleString("zh-TW")}`;
const tones: Record<Tone, string> = {
  green: "bg-[#E7F0E8] text-[#477154]",
  orange: "bg-[#FAECDD] text-[#A66932]",
  blue: "bg-[#E5EEF2] text-[#4B6D79]",
  stone: "bg-[#F0EDE8] text-[#6F6960]",
};
const toneFor = (status: StoredOrder["status"]): Tone => status === "預購中" ? "orange" : status === "未出貨" ? "blue" : status === "已出貨" ? "green" : "stone";
const outlineButton = "inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665] disabled:cursor-not-allowed disabled:opacity-45";

function Pill({ children, tone }: { children: React.ReactNode; tone: Tone }) {
  return <span className={`inline-flex min-h-6 items-center justify-center rounded-full px-2.5 py-1 text-center text-[11px] font-semibold leading-none ${tones[tone]}`}>{children}</span>;
}

function OrderDetail({ order, back, onUpdated, onDeleted, onInventoryChanged }: {
  order: StoredOrder;
  back: () => void;
  onUpdated: (order: StoredOrder) => void;
  onDeleted: (id: string) => void;
  onInventoryChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const subtotal = order.order_items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const total = subtotal + order.delivery_fee;
  const customer = order.customers;

  const complete = async () => {
    if (!window.confirm("確認扣除庫存並將訂單設為已出貨？此操作會建立庫存異動紀錄。")) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法扣庫存。");
      onUpdated(result.order);
      await onInventoryChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法扣庫存。");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`確定要刪除訂單「${order.order_number}」嗎？`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法刪除訂單。");
      onDeleted(order.id);
      await onInventoryChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法刪除訂單。");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <button onClick={back} className="text-sm font-semibold text-[#5E7665]">← 返回訂單管理</button>
        <p className="mt-5 text-[11px] font-bold tracking-[.18em] text-[#A09A90]">ORDER DETAIL</p>
        <h1 className="mt-2 text-[29px] font-semibold tracking-[-.055em]">訂單 {order.order_number}</h1>
        <p className="mt-2 text-sm text-[#7B766E]">訂單日期 {order.order_date.replaceAll("-", ".")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Pill tone={toneFor(order.status)}>{order.status}</Pill>
        <Pill tone={order.reconciliation_status === "已付款" ? "green" : "orange"}>{order.reconciliation_status}</Pill>
        <a href={`/shipping-slip?orderId=${encodeURIComponent(order.id)}`} target="_blank" rel="noreferrer" className={outlineButton}>列印出貨單</a>
        <button onClick={() => setEditing(true)} className={outlineButton}>修改訂單</button>
        {order.status !== "已出貨" && order.status !== "已取消" && <button onClick={() => { void complete(); }} disabled={saving} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#5D7B64] px-3 text-sm font-semibold text-white disabled:opacity-45">扣除庫存</button>}
        <button onClick={() => { void remove(); }} disabled={saving} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#F0D6C2] bg-white px-3 text-sm font-semibold text-[#A35F37] disabled:opacity-45">刪除訂單</button>
      </div>
    </div>
    {error && <p role="alert" className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] px-4 py-3 text-sm font-semibold text-[#9B562A]">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <section className="rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6">
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CUSTOMER</p>
          <h2 className="mt-1 text-lg font-semibold">客戶資料</h2>
          <div className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">{[["客戶姓名", customer?.name ?? "未指定"], ["LINE@名稱", customer?.line_name ?? "—"], ["電話", customer?.phone ?? "—"], ["地址", customer?.address ?? "—"]].map(([label, value]) => <div key={label}><p className="text-xs text-[#938D84]">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div>
        </section>
        <section className="overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
          <div className="border-b border-[#F0EDE8] px-5 py-5 sm:px-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">ITEMS</p><h2 className="mt-1 text-lg font-semibold">訂購商品</h2></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]"><tr><th className="px-6 py-3">商品名稱／規格</th><th className="px-3 py-3">單價</th><th className="px-3 py-3">數量</th><th className="px-6 py-3 text-right">小計</th></tr></thead><tbody className="divide-y divide-[#F0EDE8]">{order.order_items.map((item) => <tr key={item.id}><td className="px-6 py-4"><b>{item.product_name}</b><small className="mt-1 block text-xs text-[#938D84]">{item.products?.specification || "—"}</small></td><td className="px-3 py-4">{currency(item.unit_price)}</td><td className="px-3 py-4">{item.quantity}</td><td className="px-6 py-4 text-right font-semibold">{currency(item.unit_price * item.quantity)}</td></tr>)}</tbody></table></div>
        </section>
        <section className="rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">ORDER SUMMARY</p><h2 className="mt-1 text-lg font-semibold">訂單摘要</h2><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between text-[#777168]"><span>商品小計</span><span>{currency(subtotal)}</span></div>{order.delivery_method === "賣貨便" && <div className="flex justify-between text-[#777168]"><span>賣貨便運費</span><span>{order.delivery_fee ? currency(order.delivery_fee) : "免運"}</span></div>}<div className="flex justify-between border-t border-[#F0EDE8] pt-4 text-base font-semibold"><span>訂單總額</span><span>{currency(total)}</span></div></div></section>
      </div>
      <aside className="space-y-5">
        <section className="rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PAYMENT</p><h2 className="mt-1 text-lg font-semibold">付款資訊</h2><div className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><p className="text-xs text-[#938D84]">付款方式</p><p className="mt-1 font-semibold">{order.payment_method}</p></div><div><p className="text-xs text-[#938D84]">付款狀態</p><p className="mt-1 font-semibold">{order.reconciliation_status}</p></div></div></section>
        <section className="rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">INTERNAL NOTE</p><h2 className="mt-1 text-lg font-semibold">訂單備註</h2><p className="mt-4 rounded-xl bg-[#F8F6F2] p-4 text-sm leading-6 text-[#706A61]">{order.note || "—"}</p></section>
        <section className="rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">ORDER ACTIVITY</p><h2 className="mt-1 text-lg font-semibold">訂單活動</h2><div className="mt-5 space-y-5"><div className="border-l border-[#D7E4D9] pl-3"><p className="text-xs text-[#938D84]">{order.order_date}</p><p className="mt-1 text-sm font-semibold">建立訂單</p></div><div className="border-l border-[#D7E4D9] pl-3"><p className="text-xs text-[#938D84]">目前狀態</p><p className="mt-1 text-sm font-semibold">{order.status}</p><p className="mt-1 text-xs text-[#6C776D]">{order.status === "已出貨" ? "庫存已扣除完成。" : "尚未扣庫存。"}</p></div></div></section>
      </aside>
    </div>
    {editing && <OrderEditor order={order} onClose={() => setEditing(false)} onSaved={onUpdated} />}
  </>;
}

export function OrdersV2({ created, go, goLiveSale, onInventoryChanged, initialQuery = "", initialOrderId = "" }: { created: boolean; go: (view: "create") => void; goLiveSale: () => void; onInventoryChanged: () => Promise<void>; initialQuery?: string; initialOrderId?: string }) {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [selected, setSelected] = useState<StoredOrder | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState(initialQuery);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("全部");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [bulkSaving, setBulkSaving] = useState<BulkAction | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (initialOrderId) params.set("includeId", initialOrderId);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (status !== "全部") params.set("status", status);
        params.set("page", String(page));
        params.set("pageSize", "50");
        const response = await fetch(`/api/orders${params.size ? `?${params.toString()}` : ""}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "無法讀取訂單資料。");
        if (active) { setOrders(result.orders ?? []); setPagination(result.pagination ?? { page, pageSize: 50, total: 0, totalPages: 1 }); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "無法讀取訂單資料。");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [created, endDate, initialOrderId, page, startDate, status]);

  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  useEffect(() => { setSelectedIds([]); }, [endDate, query, startDate, status, page]);
  // 連線檔期從已確認訂單帶進來的資料只供直接編輯；離開詳情後不混入一般訂單列表。
  const visible = useMemo(() => orders.filter((order) => {
    if (initialOrderId && order.id === initialOrderId) return false;
    const matchesKeyword = !query.trim() || [order.order_number, order.customers?.name, order.customers?.line_name, ...order.order_items.map((item) => item.product_name)].join(" ").toLowerCase().includes(query.trim().toLowerCase());
    return matchesKeyword;
  }), [initialOrderId, orders, query]);
  const selectedOrders = useMemo(() => orders.filter((order) => selectedIds.includes(order.id)), [orders, selectedIds]);
  const printableOrders = selectedOrders.filter((order) => order.status !== "已取消");
  const arrivalOrders = selectedOrders.filter((order) => order.status === "預購中");
  const shippableOrders = selectedOrders.filter((order) => order.status !== "已出貨" && order.status !== "已取消");
  const allVisibleSelected = Boolean(visible.length) && visible.every((order) => selectedIds.includes(order.id));

  const toggleOrder = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((currentId) => currentId !== id) : [...current, id]);
  const toggleVisible = () => setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !visible.some((order) => order.id === id)) : [...new Set([...current, ...visible.map((order) => order.id)])]);
  const updateOrder = (updated: StoredOrder) => setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
  const directOrder = initialOrderId
    ? orders.find((order) => order.id === initialOrderId) ?? null
    : null;

  const printSelected = () => {
    if (!printableOrders.length) return setError("請至少選擇一筆未取消的訂單列印出貨單。");
    const search = new URLSearchParams({ orderIds: printableOrders.map((order) => order.id).join(",") });
    window.open(`/shipping-slip?${search.toString()}`, "_blank", "noopener,noreferrer");
  };

  const runBulkAction = async (action: BulkAction) => {
    const targets = action === "arrive" ? arrivalOrders : shippableOrders;
    if (!targets.length) {
      setError(action === "arrive" ? "請選擇預購中的訂單標記到貨。" : "請選擇尚未出貨且未取消的訂單。");
      return;
    }
    const message = action === "arrive"
      ? `確認將 ${targets.length} 筆預購訂單標記為已到貨？訂單會改為「未出貨」，不會扣除庫存。`
      : `確認將 ${targets.length} 筆訂單批量設為已出貨？系統會逐筆扣除庫存，若其中商品庫存不足，該筆訂單會保留原狀。`;
    if (!window.confirm(message)) return;

    setBulkSaving(action);
    setError("");
    setNotice("");
    const updates = new Map<string, StoredOrder>();
    const failures: string[] = [];
    for (const order of targets) {
      try {
        const response = await fetch(`/api/orders/${order.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "操作失敗。");
        updates.set(order.id, result.order as StoredOrder);
      } catch (reason) {
        failures.push(`${order.order_number}：${reason instanceof Error ? reason.message : "操作失敗。"}`);
      }
    }
    if (updates.size) {
      setOrders((current) => current.map((order) => updates.get(order.id) ?? order));
      setSelectedIds([]);
      if (action === "complete") await onInventoryChanged().catch(() => undefined);
      setNotice(action === "arrive" ? `已將 ${updates.size} 筆訂單標記為已到貨（未出貨）。` : `已將 ${updates.size} 筆訂單標記為已出貨並扣除庫存。`);
    }
    if (failures.length) setError(`${failures.length} 筆訂單未完成：${failures.join("；")}`);
    setBulkSaving(null);
  };

  if (initialOrderId) {
    if (loading) {
      return <section className="rounded-2xl border border-[#E9E5DF] bg-white p-8 text-center text-sm font-semibold text-[#7B766E]">正在開啟一般訂單…</section>;
    }
    if (!directOrder) {
      return <section className="rounded-2xl border border-[#F1D4C4] bg-[#FFF7F0] p-8 text-center"><p className="text-sm font-semibold text-[#9B562A]">{error || "找不到這張一般訂單，可能尚未完成轉單。"}</p><button onClick={() => window.close()} className="mt-4 text-sm font-semibold text-[#5E7665]">關閉此頁</button></section>;
    }
    return <OrderDetail order={directOrder} back={() => window.close()} onUpdated={(updated) => { updateOrder(updated); void onInventoryChanged().catch(() => undefined); }} onDeleted={(id) => { setOrders((current) => current.filter((order) => order.id !== id)); }} onInventoryChanged={onInventoryChanged} />;
  }

  if (selected) return <OrderDetail order={selected} back={() => setSelected(null)} onUpdated={(updated) => { updateOrder(updated); setSelected(updated); void onInventoryChanged().catch(() => undefined); }} onDeleted={(id) => { setOrders((current) => current.filter((order) => order.id !== id)); setSelected(null); }} onInventoryChanged={onInventoryChanged} />;

  return <>
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold tracking-[.18em] text-[#A09A90]">ORDERS</p><h1 className="mt-2 text-[29px] font-semibold tracking-[-.055em]">訂單管理</h1><p className="mt-2 text-sm text-[#7B766E]">可勾選訂單後批量列印、標記到貨或完成出貨；出貨時才會扣除庫存。</p></div><div className="flex flex-wrap gap-2"><button onClick={goLiveSale} className="inline-flex h-11 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-4 text-sm font-semibold text-[#5E7665]">連線檔期</button><button onClick={() => go("create")} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white">＋ 建立訂單</button></div></div>
    {error && <p role="alert" className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] px-4 py-3 text-sm font-semibold text-[#9B562A]">{error}</p>}
    {notice && <p role="status" className="mb-5 rounded-xl border border-[#D9E5DB] bg-[#EEF5EF] px-4 py-3 text-sm font-semibold text-[#477154]">{notice}</p>}
    <section className="overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
      <div className="flex flex-col gap-4 border-b border-[#F0EDE8] p-5 sm:p-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="flex flex-wrap items-center gap-2"><label className="flex h-11 min-w-[220px] max-w-md flex-1 items-center gap-2 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#928C84]">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" placeholder="搜尋本頁訂單編號、客戶姓名或商品" /></label><label className="flex h-11 items-center gap-2 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#6D675E]">起日<input aria-label="起始日期" type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} className="min-w-0 bg-transparent text-sm outline-none" /></label><span className="text-[#A29B92]">—</span><label className="flex h-11 items-center gap-2 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#6D675E]">迄日<input aria-label="結束日期" type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} className="min-w-0 bg-transparent text-sm outline-none" /></label>{(startDate || endDate) && <button onClick={() => { setStartDate(""); setEndDate(""); setPage(1); }} className="h-9 px-2 text-sm font-semibold text-[#5E7665]">清除日期</button>}</div><span className="text-xs text-[#807A71]">本頁 {visible.length} 筆／共 {pagination.total} 筆</span></div>
        <div className="flex gap-2 overflow-x-auto">{["全部", "預購中", "未出貨", "已出貨", "已取消", "未付款"].map((item) => <button key={item} onClick={() => { setStatus(item); setPage(1); }} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${status === item ? "bg-[#292824] text-white" : "bg-[#F4F1ED] text-[#706A61]"}`}>{item}</button>)}</div>
        {selectedOrders.length > 0 && <div className="flex flex-col gap-3 rounded-xl border border-[#D9E4DE] bg-[#F5F8F5] p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-[#4B5F50]">已選取 {selectedOrders.length} 筆訂單</p><div className="flex flex-wrap gap-2"><button onClick={printSelected} disabled={!printableOrders.length || bulkSaving !== null} className={outlineButton}>批量列印出貨單</button><button onClick={() => { void runBulkAction("arrive"); }} disabled={!arrivalOrders.length || bulkSaving !== null} className={outlineButton}>{bulkSaving === "arrive" ? "標記中…" : "批量標記到貨"}</button><button onClick={() => { void runBulkAction("complete"); }} disabled={!shippableOrders.length || bulkSaving !== null} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#5D7B64] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{bulkSaving === "complete" ? "出貨處理中…" : "批量已出貨"}</button><button onClick={() => setSelectedIds([])} disabled={bulkSaving !== null} className="h-10 px-2 text-sm font-semibold text-[#5E7665]">取消選取</button></div></div>}
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1140px] text-left text-sm"><thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]"><tr><th className="w-12 px-4 py-3"><input aria-label="選取全部目前列表訂單" type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} /></th><th className="px-3 py-3">訂單編號</th><th className="px-3 py-3">訂單日期</th><th className="px-3 py-3">客戶</th><th className="px-3 py-3">商品</th><th className="px-3 py-3">金額</th><th className="px-3 py-3">付款方式</th><th className="px-3 py-3">付款狀態</th><th className="px-3 py-3">訂單狀態</th><th className="px-3 py-3">庫存狀態</th><th className="px-6 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-[#F0EDE8]">{loading ? <tr><td colSpan={11} className="px-6 py-10 text-center text-[#8D877E]">載入訂單中…</td></tr> : visible.length ? visible.map((order) => { const total = order.order_items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0) + order.delivery_fee; return <tr key={order.id} onClick={() => setSelected(order)} className="cursor-pointer hover:bg-[#FCFBF9]"><td className="px-4 py-4"><input aria-label={`選取訂單 ${order.order_number}`} type="checkbox" checked={selectedIds.includes(order.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleOrder(order.id)} /></td><td className="px-3 py-4 font-semibold">{order.order_number}</td><td className="px-3 py-4 text-[#777168]">{order.order_date}</td><td className="px-3 py-4">{order.customers?.name ?? "未指定"}</td><td className="px-3 py-4">{order.order_items.reduce((sum, item) => sum + item.quantity, 0)} 件</td><td className="px-3 py-4 font-medium">{currency(total)}</td><td className="px-3 py-4 text-[#625D55]">{order.payment_method}</td><td className="px-3 py-4"><Pill tone={order.reconciliation_status === "已付款" ? "green" : "orange"}>{order.reconciliation_status}</Pill></td><td className="px-3 py-4"><Pill tone={toneFor(order.status)}>{order.status}</Pill></td><td className="px-3 py-4"><Pill tone={order.status === "已出貨" ? "green" : "stone"}>{order.status === "已出貨" ? "已扣除" : "未扣除"}</Pill></td><td className="px-6 py-4 text-right"><button onClick={(event) => { event.stopPropagation(); setSelected(order); }} className="text-sm font-semibold text-[#5E7665]">查看／修改 →</button></td></tr>; }) : <tr><td colSpan={11} className="px-6 py-10 text-center text-[#8D877E]">找不到符合條件的訂單。</td></tr>}</tbody></table></div>
      <div className="flex items-center justify-between gap-3 border-t border-[#F0EDE8] px-5 py-4 text-sm"><span className="text-[#807A71]">第 {pagination.page}／{pagination.totalPages} 頁</span><div className="flex gap-2"><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || pagination.page <= 1} className={outlineButton}>上一頁</button><button onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={loading || pagination.page >= pagination.totalPages} className={outlineButton}>下一頁</button></div></div>
    </section>
  </>;
}
