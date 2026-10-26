"use client";

import { useEffect, useMemo, useState } from "react";

type DisplayStatus = "未通知" | "已通知" | "已出貨";
type OrderStatus = "預購中" | "未出貨" | "已出貨" | "已取消";

type ConfirmedLiveSaleOrder = {
  id: string;
  claim_number: string;
  customer_name: string;
  line_name: string;
  notification_status: "未通知" | "已通知";
  claim_total: number;
  created_at: string;
  campaign: { name: string; campaign_code: string } | null;
  display_status: DisplayStatus;
  order: {
    id: string;
    order_number: string;
    order_date: string;
    status: OrderStatus;
    payment_method: string;
    reconciliation_status: string;
    delivery_method: string;
    total: number;
    order_items: Array<{ id: string; product_name: string; quantity: number }>;
  };
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

const outlineButton = "inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665] disabled:cursor-not-allowed disabled:opacity-45";
const currency = (value: number) => `NT$ ${value.toLocaleString("zh-TW")}`;

function Pill({ children, tone }: { children: React.ReactNode; tone: "green" | "orange" | "blue" | "stone" }) {
  const tones = {
    green: "bg-[#E7F0E8] text-[#477154]",
    orange: "bg-[#FAECDD] text-[#A66932]",
    blue: "bg-[#E5EEF2] text-[#4B6D79]",
    stone: "bg-[#F0EDE8] text-[#6F6960]",
  };
  return <span className={`inline-flex min-h-6 items-center justify-center rounded-full px-2.5 py-1 text-center text-[11px] font-semibold leading-none ${tones[tone]}`}>{children}</span>;
}

function orderTone(status: OrderStatus) {
  return status === "預購中" ? "orange" : status === "未出貨" ? "blue" : status === "已出貨" ? "green" : "stone";
}

function confirmedTone(status: DisplayStatus) {
  return status === "未通知" ? "orange" : status === "已通知" ? "blue" : "green";
}

export function ConfirmedLiveSaleOrdersPage() {
  const [orders, setOrders] = useState<ConfirmedLiveSaleOrder[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"全部" | DisplayStatus>("全部");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<DisplayStatus>("未通知");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, endDate, startDate, status]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: "50" });
        if (debouncedQuery) params.set("query", debouncedQuery);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (status !== "全部") params.set("status", status);
        const response = await fetch(`/api/live-sale/confirmed-orders?${params.toString()}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "無法讀取已結單訂單。 ");
        if (active) {
          setOrders(result.orders ?? []);
          setPagination(result.pagination ?? { page, pageSize: 50, total: 0, totalPages: 1 });
          setError("");
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "無法讀取已結單訂單。 ");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [debouncedQuery, endDate, page, reloadKey, startDate, status]);

  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedQuery, endDate, page, startDate, status]);

  const selectedOrders = useMemo(() => orders.filter((item) => selectedIds.includes(item.id)), [orders, selectedIds]);
  const printableOrders = selectedOrders.filter((item) => item.order.status !== "已取消");
  const allVisibleSelected = Boolean(orders.length) && orders.every((item) => selectedIds.includes(item.id));

  const toggleOrder = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((currentId) => currentId !== id) : [...current, id]);
  };

  const toggleVisible = () => {
    setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !orders.some((item) => item.id === id)) : [...new Set([...current, ...orders.map((item) => item.id)])]);
  };

  const printSelected = () => {
    if (!printableOrders.length) {
      setError("請至少選擇一筆未取消的已結單訂單列印出貨單。 ");
      return;
    }
    const params = new URLSearchParams({ orderIds: printableOrders.map((item) => item.order.id).join(",") });
    window.open(`/shipping-slip?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  const exportSelected = () => {
    if (!selectedOrders.length) {
      setError("請至少選擇一筆已結單訂單匯出。 ");
      return;
    }
    const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["一般訂單編號", "喊單編號", "檔期", "客戶名稱", "LINE@名稱", "商品", "總金額", "付款方式", "付款狀態", "訂單狀況", "配送方式"],
      ...selectedOrders.map((item) => [
        item.order.order_number,
        item.claim_number,
        item.campaign?.name ?? "—",
        item.customer_name,
        item.line_name,
        item.order.order_items.map((line) => `${line.product_name} × ${line.quantity}`).join("；"),
        item.order.total,
        item.order.payment_method,
        item.order.reconciliation_status,
        item.display_status,
        item.order.delivery_method,
      ]),
    ];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(cell).join(",")).join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "已結單訂單.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const applyBulkStatus = async () => {
    if (!selectedOrders.length) {
      setError("請先勾選要修改的已結單訂單。 ");
      return;
    }
    const shippableOrders = selectedOrders.filter((item) => item.order.status !== "已出貨" && item.order.status !== "已取消");
    if (bulkStatus === "已出貨" && !shippableOrders.length) {
      setError("選取的訂單皆已出貨或已取消，沒有可出貨的訂單。 ");
      return;
    }
    const targetCount = bulkStatus === "已出貨" ? shippableOrders.length : selectedOrders.length;
    const message = bulkStatus === "已出貨"
      ? `確認將 ${targetCount} 筆已結單訂單設為已出貨？系統會逐筆扣除庫存。`
      : `確認將 ${targetCount} 筆已結單訂單改為「${bulkStatus}」？`;
    if (!window.confirm(message)) return;

    setBulkSaving(true);
    setError("");
    setNotice("");
    const targets = bulkStatus === "已出貨" ? shippableOrders : selectedOrders;
    const failures: string[] = [];
    for (const item of targets) {
      try {
        const response = bulkStatus === "已出貨"
          ? await fetch(`/api/orders/${item.order.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "complete" }),
          })
          : await fetch(`/api/live-sale/claims/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "setNotification", notificationStatus: bulkStatus }),
          });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "更新失敗。 ");
      } catch (reason) {
        failures.push(`${item.order.order_number}：${reason instanceof Error ? reason.message : "更新失敗。"}`);
      }
    }
    setSelectedIds([]);
    setReloadKey((value) => value + 1);
    setBulkSaving(false);
    if (failures.length) setError(`${failures.length} 筆未更新：${failures.join("；")}`);
    else setNotice(`已更新 ${targets.length} 筆已結單訂單為「${bulkStatus}」。`);
  };

  const openOrder = (orderId: string) => {
    window.open(`/orders/${encodeURIComponent(orderId)}`, "_blank", "noopener,noreferrer");
  };

  return <main className="min-h-screen bg-[#F8F7F4] px-5 py-7 text-[#292824] sm:px-8 sm:py-10">
    <div className="mx-auto max-w-[1440px]">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <a href="/?view=orders" className="text-sm font-semibold text-[#5E7665]">← 返回訂單管理</a>
          <p className="mt-5 text-[11px] font-bold tracking-[.18em] text-[#A09A90]">LIVE SALE ORDERS</p>
          <h1 className="mt-2 text-[29px] font-semibold tracking-[-.055em]">已結單訂單管理</h1>
          <p className="mt-2 text-sm text-[#7B766E]">已由連線檔期轉成一般訂單的清單；可勾選多筆後批量列印、匯出或更新通知／出貨狀況。</p>
        </div>
        <a href="/?view=liveSale" className="inline-flex h-11 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-4 text-sm font-semibold text-[#5E7665]">連線檔期</a>
      </div>

      {error && <p role="alert" className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] px-4 py-3 text-sm font-semibold text-[#9B562A]">{error}</p>}
      {notice && <p role="status" className="mb-5 rounded-xl border border-[#D9E5DB] bg-[#EEF5EF] px-4 py-3 text-sm font-semibold text-[#477154]">{notice}</p>}

      <section className="overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#F0EDE8] p-5 sm:p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-11 min-w-[230px] max-w-md flex-1 items-center gap-2 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#928C84]">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" placeholder="搜尋訂單、檔期、客戶或商品" /></label>
              <label className="flex h-11 items-center gap-2 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#6D675E]">起日<input aria-label="起始日期" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="min-w-0 bg-transparent text-sm outline-none" /></label>
              <span className="text-[#A29B92]">—</span>
              <label className="flex h-11 items-center gap-2 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#6D675E]">迄日<input aria-label="結束日期" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="min-w-0 bg-transparent text-sm outline-none" /></label>
              {(startDate || endDate) && <button onClick={() => { setStartDate(""); setEndDate(""); }} className="h-9 px-2 text-sm font-semibold text-[#5E7665]">清除日期</button>}
            </div>
            <span className="text-xs text-[#807A71]">本頁 {orders.length} 筆／共 {pagination.total} 筆</span>
          </div>
          <div className="flex gap-2 overflow-x-auto">{(["全部", "未通知", "已通知", "已出貨"] as const).map((item) => <button key={item} onClick={() => setStatus(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${status === item ? "bg-[#292824] text-white" : "bg-[#F4F1ED] text-[#706A61]"}`}>{item}</button>)}</div>
          {selectedOrders.length > 0 && <div className="flex flex-col gap-3 rounded-xl border border-[#D9E4DE] bg-[#F5F8F5] p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-[#4B5F50]">已選取 {selectedOrders.length} 筆已結單訂單</p><div className="flex flex-wrap gap-2"><button onClick={printSelected} disabled={!printableOrders.length || bulkSaving} className={outlineButton}>批量列印出貨單</button><button onClick={exportSelected} disabled={bulkSaving} className={outlineButton}>批量匯出訂單</button><select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as DisplayStatus)} disabled={bulkSaving} className="h-10 rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665] disabled:opacity-45"><option>未通知</option><option>已通知</option><option>已出貨</option></select><button onClick={() => { void applyBulkStatus(); }} disabled={bulkSaving} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#5D7B64] px-3 text-sm font-semibold text-white disabled:opacity-45">{bulkSaving ? "更新中…" : "修改訂單狀況"}</button><button onClick={() => setSelectedIds([])} disabled={bulkSaving} className="h-10 px-2 text-sm font-semibold text-[#5E7665]">取消選取</button></div></div>}
        </div>

        <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left text-sm"><thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]"><tr><th className="w-12 px-4 py-3"><input aria-label="選取全部目前列表已結單訂單" type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} /></th><th className="px-3 py-3">一般訂單編號</th><th className="px-3 py-3">檔期</th><th className="px-3 py-3">訂單日期</th><th className="px-3 py-3">客戶</th><th className="px-3 py-3">商品</th><th className="px-3 py-3">總金額</th><th className="px-3 py-3">付款方式</th><th className="px-3 py-3">付款狀態</th><th className="px-3 py-3">訂單狀況</th><th className="px-3 py-3">一般訂單狀態</th><th className="px-6 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-[#F0EDE8]">{loading ? <tr><td colSpan={12} className="px-6 py-10 text-center text-[#8D877E]">載入已結單訂單中…</td></tr> : orders.length ? orders.map((item) => <tr key={item.id} onClick={() => openOrder(item.order.id)} className="cursor-pointer hover:bg-[#FCFBF9]"><td className="px-4 py-4"><input aria-label={`選取訂單 ${item.order.order_number}`} type="checkbox" checked={selectedIds.includes(item.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleOrder(item.id)} /></td><td className="px-3 py-4 font-semibold">{item.order.order_number}<small className="mt-1 block text-xs font-normal text-[#938D84]">喊單 {item.claim_number}</small></td><td className="px-3 py-4"><p className="font-medium">{item.campaign?.name ?? "—"}</p><small className="mt-1 block text-xs text-[#938D84]">{item.campaign?.campaign_code ?? ""}</small></td><td className="px-3 py-4 text-[#777168]">{item.order.order_date}</td><td className="px-3 py-4"><p>{item.customer_name || "未指定"}</p>{item.line_name && <small className="mt-1 block text-xs text-[#938D84]">{item.line_name}</small>}</td><td className="px-3 py-4">{item.order.order_items.reduce((sum, line) => sum + line.quantity, 0)} 件</td><td className="px-3 py-4 font-medium">{currency(item.order.total || item.claim_total)}</td><td className="px-3 py-4 text-[#625D55]">{item.order.payment_method}</td><td className="px-3 py-4"><Pill tone={item.order.reconciliation_status === "已付款" ? "green" : "orange"}>{item.order.reconciliation_status}</Pill></td><td className="px-3 py-4"><Pill tone={confirmedTone(item.display_status)}>{item.display_status}</Pill></td><td className="px-3 py-4"><Pill tone={orderTone(item.order.status)}>{item.order.status}</Pill></td><td className="px-6 py-4 text-right"><button onClick={(event) => { event.stopPropagation(); openOrder(item.order.id); }} className="text-sm font-semibold text-[#5E7665]">查看／修改 →</button></td></tr>) : <tr><td colSpan={12} className="px-6 py-10 text-center text-[#8D877E]">找不到符合條件的已結單訂單。</td></tr>}</tbody></table></div>
        <div className="flex items-center justify-between gap-3 border-t border-[#F0EDE8] px-5 py-4 text-sm"><span className="text-[#807A71]">第 {pagination.page}／{pagination.totalPages} 頁</span><div className="flex gap-2"><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || pagination.page <= 1} className={outlineButton}>上一頁</button><button onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={loading || pagination.page >= pagination.totalPages} className={outlineButton}>下一頁</button></div></div>
      </section>
    </div>
  </main>;
}
