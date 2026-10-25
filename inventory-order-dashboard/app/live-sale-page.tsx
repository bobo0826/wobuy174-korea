"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Product = { id: string | number; sku: string; name: string; country: string; category: string; subcategory: string; specification: string; cost: number; retailPrice: number };
type Customer = { id: string; name: string; line_name: string; customer_category: "員工" | "社群"; preferred_delivery_method: "自取" | "賣貨便"; phone?: string; address?: string };
type ClaimStatus = "待核對" | "待結帳" | "已結帳" | "已轉訂單" | "已取消";
type NotificationStatus = "未通知" | "已通知";
type ClaimItem = { id?: string; product_id: string | null; product_name: string; category: string; specification: string; unit_price: number; quantity: number };
type ConvertedOrder = { id: string; order_number: string; status: "預購中" | "未出貨" | "已出貨" | "已取消"; payment_method: string; reconciliation_status: string; delivery_method: string; total: number };
type Claim = { id: string; claim_number: string; customer_id: string | null; customer_name: string; line_name: string; community_name: string; source_inbox_id: string | null; status: ClaimStatus; notification_status: NotificationStatus; claim_total: number; note: string; converted_order_id: string | null; converted_order?: ConvertedOrder | null; created_at: string; items: ClaimItem[] };
type Summary = { claimCount: number; activeAmount: number; paidAmount: number; pendingAmount: number; unresolvedCount: number };
type Campaign = { id: string; name: string; campaign_code: string; status: "進行中" | "已結單" | "已封存"; start_date: string; end_date: string | null; note: string; summary: Summary };
type Procurement = { productId: string | null; productName: string; specification: string; category: string; demandQuantity: number; paidQuantity: number; unresolvedQuantity: number; availableQuantity: number | null; purchaseQuantity: number | null; shortageQuantity: number | null; affectedCustomers: Array<{ claimId: string; claimNumber: string; customerName: string; quantity: number }> };
type Detail = { campaign: Campaign; claims: Claim[]; summary: Summary; procurement: Procurement[] };
type Inbox = { id: string; message_text: string; parsed_items: Array<{ product_id: string | null; product_name: string; specification: string; unit_price: number; quantity: number }>; matched_customer: { id: string; name: string; line_name: string } | null };
type Line = { key: string; productId: string; productName: string; category: string; specification: string; unitPrice: number; quantity: number };
type ActionName = "markPaid" | "markUnpaid" | "cancel" | "restore" | "convert" | "delete";

const money = (value: number) => `NT$ ${Number(value || 0).toLocaleString("zh-TW")}`;
const day = (value: string | null) => value ? value.replaceAll("-", "/") : "—";
const lineKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const button = "inline-flex h-10 items-center justify-center rounded-xl bg-[#292824] px-3 text-sm font-semibold text-white disabled:opacity-45";
const secondary = "inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665] disabled:opacity-45";
const tone: Record<ClaimStatus, string> = { "待核對": "bg-[#FAECDD] text-[#A66932]", "待結帳": "bg-[#E5EEF2] text-[#4B6D79]", "已結帳": "bg-[#E7F0E8] text-[#477154]", "已轉訂單": "bg-[#E9E6F4] text-[#625184]", "已取消": "bg-[#F0EDE8] text-[#6F6960]" };

function Pill({ status }: { status: ClaimStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone[status]}`}>{status}</span>;
}

function ConfirmedStatusPill({ claim }: { claim: Claim }) {
  const label = claim.converted_order?.status === "已出貨" ? "已出貨" : claim.notification_status || "未通知";
  const classes = label === "已出貨" ? "bg-[#E7F0E8] text-[#477154]" : label === "已通知" ? "bg-[#E5EEF2] text-[#4B6D79]" : "bg-[#FAECDD] text-[#A66932]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${classes}`}>{label}</span>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-[#EAE6E0] bg-[#FCFBF9] p-4"><p className="text-xs font-semibold text-[#837D73]">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-[#938D84]">{note}</p></div>;
}

function ProductSearch({ products, onAdd }: { products: Product[]; onAdd: (product: Product) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const word = query.trim().toLocaleLowerCase("zh-TW");
    return products.filter((item) => [item.sku, item.name, item.country, item.category, item.subcategory, item.specification].join(" ").toLocaleLowerCase("zh-TW").includes(word));
  }, [products, query]);

  return <div className="relative">
    <label className="flex h-11 items-center gap-2 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#928C84]">⌕
      <input value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} placeholder="搜尋貨號、商品名稱或分類後加入商品" className="min-w-0 flex-1 bg-transparent text-[#58534C] outline-none" />
    </label>
    {open && <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-[#E6E1DB] bg-white p-1 shadow-lg">
      {matches.length ? matches.map((item) => <button key={item.id} type="button" onClick={() => { onAdd(item); setQuery(""); setOpen(false); }} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-[#F8F6F2]">
        <span className="min-w-0"><b className="block truncate text-sm">{item.sku}｜{item.name}</b><small className="mt-1 block truncate text-xs text-[#8D877E]">{[item.country, item.category, item.subcategory, item.specification].filter(Boolean).join(" · ")}</small></span>
        <span className="shrink-0 text-xs font-semibold text-[#5E7665]">加入商品</span>
      </button>) : <p className="p-4 text-sm text-[#8D877E]">找不到可加入的商品。</p>}
    </div>}
  </div>;
}

function ClaimEditor({ campaignId, catalog, customers, initial, inbox, onCancel, onSaved, onAction, openOrder, onCustomerCreated }: {
  campaignId: string; catalog: Product[]; customers: Customer[]; initial?: Claim; inbox?: Inbox | null; onCancel: () => void; onSaved: () => Promise<void>; onAction: (claim: Claim, action: ActionName) => Promise<void>; openOrder: (id: string) => void; onCustomerCreated: (customer: Customer) => void;
}) {
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? inbox?.matched_customer?.id ?? "");
  const [customerName, setCustomerName] = useState(initial?.customer_name ?? inbox?.matched_customer?.name ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerSaving, setNewCustomerSaving] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", lineName: "", customerCategory: "社群" as Customer["customer_category"], preferredDeliveryMethod: "自取" as Customer["preferred_delivery_method"] });
  const [lines, setLines] = useState<Line[]>(initial?.items.length
    ? initial.items.map((item) => ({ key: item.id ?? lineKey(), productId: item.product_id ?? "", productName: item.product_name, category: item.category, specification: item.specification, unitPrice: item.unit_price, quantity: item.quantity }))
    : inbox?.parsed_items.map((item) => ({ key: lineKey(), productId: item.product_id ?? "", productName: item.product_name, category: "", specification: item.specification, unitPrice: item.unit_price, quantity: item.quantity })) ?? []);
  const catalogById = useMemo(() => new Map(catalog.map((item) => [String(item.id), item])), [catalog]);
  const locked = initial?.status === "已轉訂單";
  const foundCustomers = useMemo(() => {
    const word = customerName.trim().toLocaleLowerCase("zh-TW");
    return !word || customerId ? [] : customers.filter((item) => `${item.name} ${item.line_name} ${item.customer_category}`.toLocaleLowerCase("zh-TW").includes(word)).slice(0, 8);
  }, [customerId, customerName, customers]);
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const totalProfit = lines.reduce<number | null>((sum, line) => {
    const product = catalogById.get(line.productId);
    return sum === null || !product ? null : sum + (line.unitPrice - product.cost) * line.quantity;
  }, 0);

  const add = (product: Product) => setLines((current) => {
    const existing = current.find((line) => line.productId === String(product.id));
    return existing ? current.map((line) => line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { key: lineKey(), productId: String(product.id), productName: product.name, category: [product.country, product.category, product.subcategory].filter(Boolean).join(" · "), specification: product.specification, unitPrice: product.retailPrice, quantity: 1 }];
  });

  const createCustomer = async () => {
    if (!newCustomer.name.trim()) { setError("請填寫客戶姓名後再建立客戶。"); return; }
    setNewCustomerSaving(true); setError("");
    try {
      const response = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newCustomer) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法建立客戶。");
      const customer = result.customer as Customer;
      onCustomerCreated(customer);
      setCustomerId(customer.id);
      setCustomerName(`${customer.name}${customer.line_name ? ` · ${customer.line_name}` : ""}`);
      setShowNewCustomer(false);
      setNewCustomer({ name: "", lineName: "", customerCategory: "社群", preferredDeliveryMethod: "自取" });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法建立客戶。"); } finally { setNewCustomerSaving(false); }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      if (!lines.length) throw new Error("請先加入至少一項商品。");
      const payload = { customerId: customerId || undefined, communityName: initial?.community_name || "LINE 私訊", note, sourceInboxId: initial?.source_inbox_id ?? inbox?.id ?? undefined, items: lines.map((line) => ({ productId: line.productId || undefined, productName: line.productName, specification: line.specification, unitPrice: line.unitPrice, quantity: line.quantity })) };
      const response = await fetch(initial ? `/api/live-sale/claims/${initial.id}` : `/api/live-sale/campaigns/${campaignId}/claims`, { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(initial ? { action: "update", ...payload } : payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法儲存喊單。");
      await onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法儲存喊單。"); } finally { setSaving(false); }
  };

  return <form onSubmit={save} className="mx-auto max-w-6xl">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><button type="button" onClick={onCancel} className="text-sm font-semibold text-[#5E7665]">← 返回喊單列表</button><p className="mt-5 text-[11px] font-bold tracking-[.16em] text-[#A09A90]">LIVE SALE CLAIM</p><h1 className="mt-2 text-[29px] font-semibold">{initial ? `喊單 ${initial.claim_number}` : "建立連線喊單"}</h1><p className="mt-2 text-sm text-[#7B766E]">可用貨號、商品名稱或分類搜尋加入商品，版面與一般訂單一致。</p></div>
      {initial && <div className="flex flex-wrap gap-2"><Pill status={initial.status} />
        {initial.status === "待結帳" && <button type="button" onClick={() => void onAction(initial, "markPaid")} className={button}>確認結帳並轉訂單</button>}
        {initial.status === "已結帳" && <><button type="button" onClick={() => void onAction(initial, "convert")} className={button}>重新轉一般訂單</button><button type="button" onClick={() => void onAction(initial, "markUnpaid")} className={secondary}>回待結帳</button></>}
        {initial.status === "已取消" && <button type="button" onClick={() => void onAction(initial, "restore")} className={secondary}>復原喊單</button>}
        {initial.status !== "已取消" && initial.status !== "已轉訂單" && <button type="button" onClick={() => void onAction(initial, "cancel")} className="inline-flex h-10 items-center rounded-xl border border-[#F0D6C2] bg-white px-3 text-sm font-semibold text-[#A35F37]">取消喊單</button>}
        <button type="button" onClick={() => void onAction(initial, "delete")} className="inline-flex h-10 items-center rounded-xl border border-[#F0D6C2] bg-white px-3 text-sm font-semibold text-[#A35F37]">刪除喊單</button>
        {initial.converted_order_id && <button type="button" onClick={() => openOrder(initial.converted_order_id!)} className={secondary}>編輯訂單</button>}
      </div>}
    </div>
    {inbox && <section className="mb-5 rounded-2xl border border-[#DEE8DF] bg-[#F8FBF8] p-5"><p className="text-xs font-semibold text-[#5E7665]">LINE 私訊原文</p><p className="mt-2 whitespace-pre-wrap text-sm">{inbox.message_text}</p></section>}
    {error && <p className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] p-3 text-sm text-[#A35F37]">{error}</p>}

    <section className="rounded-2xl border border-[#E9E5DF] bg-white p-5"><div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">喊單來源<p className="mt-2 flex h-10 items-center rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal">{initial?.community_name || "LINE 私訊"}</p></label>
      <div className="relative text-sm font-semibold"><div className="flex items-center justify-between gap-3"><span>客戶／LINE@ 名稱</span>{!locked && <button type="button" onClick={() => setShowNewCustomer((value) => !value)} className="text-xs font-semibold text-[#5E7665]">＋ 直接建立客戶</button>}</div>
        <input disabled={locked} value={customerName} onChange={(event) => { setCustomerName(event.target.value); setCustomerId(""); }} placeholder="搜尋姓名、LINE@ 名稱或員工" className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 font-normal outline-none" />
        {!customerId && customerName && <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[#DDD8D1] bg-white p-1 shadow-lg">{foundCustomers.length ? foundCustomers.map((item) => <button key={item.id} type="button" onClick={() => { setCustomerId(item.id); setCustomerName(`${item.name}${item.line_name ? ` · ${item.line_name}` : ""}`); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-[#F3F7F3]"><span><b className="block">{item.name}</b><small className="text-xs font-normal text-[#847E75]">{item.line_name || "未填 LINE@ 名稱"}</small></span><span className="rounded-full bg-[#E7F0E8] px-2 py-1 text-[11px]">{item.customer_category}</span></button>) : <p className="p-3 text-xs font-normal text-[#8D877E]">找不到相符客戶；可直接建立。</p>}</div>}
      </div>
    </div>
    {showNewCustomer && <div className="mt-5 rounded-xl border border-[#D9E5DB] bg-[#F6FAF6] p-4"><div className="mb-3 flex items-center justify-between"><b className="text-sm">建立客戶並直接帶入喊單</b><button type="button" onClick={() => setShowNewCustomer(false)} className="text-sm text-[#6F6960]">關閉</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-semibold">客戶姓名<input value={newCustomer.name} onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal" /></label><label className="text-xs font-semibold">LINE@ 名稱<input value={newCustomer.lineName} onChange={(event) => setNewCustomer({ ...newCustomer, lineName: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal" /></label><label className="text-xs font-semibold">客戶類別<select value={newCustomer.customerCategory} onChange={(event) => setNewCustomer({ ...newCustomer, customerCategory: event.target.value as Customer["customer_category"] })} className="mt-1 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal"><option>社群</option><option>員工</option></select></label><label className="text-xs font-semibold">常用配送方式<select value={newCustomer.preferredDeliveryMethod} onChange={(event) => setNewCustomer({ ...newCustomer, preferredDeliveryMethod: event.target.value as Customer["preferred_delivery_method"] })} className="mt-1 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal"><option>自取</option><option>賣貨便</option></select></label></div><div className="mt-3 flex justify-end"><button disabled={newCustomerSaving} type="button" onClick={() => void createCustomer()} className={secondary}>{newCustomerSaving ? "建立中…" : "建立並選取客戶"}</button></div></div>}
    </section>

    <section className="mt-5 overflow-visible rounded-2xl border border-[#E9E5DF] bg-white"><div className="border-b border-[#F0EDE8] p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">ITEMS</p><h2 className="mt-1 text-lg font-semibold">加入商品</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]"><tr><th className="px-5 py-3">貨號</th><th className="px-3 py-3">分類</th><th className="px-3 py-3">商品名稱</th><th className="px-3 py-3">單價</th><th className="px-3 py-3">數量</th><th className="px-3 py-3">淨利</th><th className="px-5 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-[#F0EDE8]">{lines.length ? lines.map((line) => { const product = catalogById.get(line.productId); const profit = product ? (line.unitPrice - product.cost) * line.quantity : null; return <tr key={line.key}><td className="px-5 py-4 font-mono text-xs text-[#6E695F]">{product?.sku || "—"}</td><td className="px-3 py-4 text-xs">{line.category || "—"}</td><td className="px-3 py-4"><b>{line.productName || "待核對商品"}</b><small className="mt-1 block text-xs text-[#938D84]">{line.specification || "未填規格"}</small></td><td className="px-3 py-4"><input disabled={locked} type="number" min="0" value={line.unitPrice} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, unitPrice: Math.max(0, Number(event.target.value) || 0) } : item))} className="h-9 w-24 rounded-lg border border-[#E6E1DB] bg-[#FCFBF9] px-2" /></td><td className="px-3 py-4"><input disabled={locked} type="number" min="1" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item))} className="h-9 w-20 rounded-lg border border-[#E6E1DB] bg-[#FCFBF9] px-2" /></td><td className={`px-3 py-4 font-semibold ${profit === null ? "text-[#928C83]" : profit < 0 ? "text-[#A66932]" : "text-[#477154]"}`}>{profit === null ? "—" : money(profit)}</td><td className="px-5 py-4 text-right"><button disabled={locked} type="button" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} className="text-sm font-semibold text-[#A35F37] disabled:opacity-40">移除</button></td></tr>; }) : <tr><td colSpan={7} className="p-10 text-center text-[#8D877E]">請先搜尋並加入商品。</td></tr>}</tbody></table></div>{!locked && <div className="border-t border-[#F0EDE8] p-5"><ProductSearch products={catalog} onAdd={add} /></div>}<div className="flex flex-wrap justify-between gap-3 border-t border-[#F0EDE8] px-5 py-4 text-sm">喊單總額 <b>{money(total)}</b><span>訂單淨利 <b className="text-[#477154]">{totalProfit === null ? "待核對" : money(totalProfit)}</b></span></div></section>
    <label className="mt-5 block text-sm font-semibold">內部備註<textarea disabled={locked} value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-[#E6E1DB] p-3 font-normal" /></label>
    {!locked && <div className="mt-5 flex justify-end"><button disabled={saving} className={button}>{saving ? "儲存中…" : initial ? "儲存喊單修改" : "建立待核對喊單"}</button></div>}
  </form>;
}

function CampaignDetailPage({ campaignId, catalog, openOrder, back, onDeleted }: { campaignId: string; catalog: Product[]; openOrder: (id: string) => void; back: () => void; onDeleted: () => Promise<void> }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [inbox, setInbox] = useState<Inbox[]>([]);
  const [editor, setEditor] = useState<{ claim?: Claim; inbox?: Inbox | null } | null>(null);
  const [claimTab, setClaimTab] = useState<"open" | "confirmed">("open");
  const [selectedConfirmedIds, setSelectedConfirmedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<NotificationStatus | "已出貨">("已通知");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Campaign["status"]>("進行中");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const catalogById = useMemo(() => new Map(catalog.map((item) => [String(item.id), item])), [catalog]);

  const load = async () => {
    setLoading(true);
    try {
      const [detailResponse, inboxResponse] = await Promise.all([fetch(`/api/live-sale/campaigns/${campaignId}`), fetch(`/api/live-sale/inbox?status=%E5%BE%85%E8%99%95%E7%90%86&campaignId=${encodeURIComponent(campaignId)}`)]);
      const [detailData, inboxData] = await Promise.all([detailResponse.json(), inboxResponse.json()]);
      if (!detailResponse.ok) throw new Error(detailData.message ?? "無法讀取連線檔期。");
      if (!inboxResponse.ok) throw new Error(inboxData.message ?? "無法讀取 LINE 私訊。");
      const next = detailData as Detail;
      setDetail(next); setInbox(inboxData.inbox ?? []); setName(next.campaign.name); setStatus(next.campaign.status); setStartDate(next.campaign.start_date); setEndDate(next.campaign.end_date ?? ""); setNote(next.campaign.note); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法讀取連線檔期。"); } finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { setCustomers([]); setCustomersLoaded(false); setClaimTab("open"); void load(); }, 0);
    return () => window.clearTimeout(timer);
    // 只在切換檔期時重讀資料；load 會同步本次檔期的內容。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);
  const openEditor = async (value: { claim?: Claim; inbox?: Inbox | null }) => {
    setOpening(true);
    try {
      if (!customersLoaded) {
        const response = await fetch("/api/customers"); const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "無法讀取客戶資料。");
        setCustomers(result.customers ?? []); setCustomersLoaded(true);
      }
      setEditor(value);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法開啟喊單。"); } finally { setOpening(false); }
  };
  const action = async (claim: Claim, actionName: ActionName) => {
    const message = actionName === "convert" ? `確認把 ${claim.claim_number} 重新轉為一般訂單？` : actionName === "cancel" ? `確定取消 ${claim.claim_number}？` : actionName === "delete" ? claim.converted_order_id ? `確定刪除 ${claim.claim_number} 與它尚未出貨的已確認訂單？` : `確定刪除 ${claim.claim_number}？` : actionName === "markPaid" ? `確認結帳 ${claim.claim_number}？系統會立即建立連線專用訂單，並移至「已確認訂單」，一般訂單清單不會顯示。` : "";
    if (message && !window.confirm(message)) return;
    const response = await fetch(`/api/live-sale/claims/${claim.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName }) });
    const result = await response.json();
    if (!response.ok) { setError(result.message ?? "無法更新喊單。"); return; }
    if (actionName === "markPaid" || actionName === "convert") { setNotice(`已建立連線專用訂單 ${result.order?.order_number ?? ""}，可在已確認訂單編輯。`); setClaimTab("confirmed"); } else if (actionName === "delete") setNotice("喊單已刪除。"); else setNotice("喊單狀態已更新。");
    await load(); setEditor(null);
  };
  const claimStatus = (claim: Claim) => claim.converted_order?.status === "已出貨" ? "已出貨" : claim.notification_status || "未通知";
  const exportConfirmed = (claimsToExport: Claim[]) => {
    if (!claimsToExport.length) return setError("請至少選擇一筆已確認訂單匯出。");
    const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [["訂單編號", "喊單編號", "客戶名稱", "LINE@名稱", "商品明細", "總金額", "付款方式", "付款狀態", "訂單狀況", "配送方式"], ...claimsToExport.map((claim) => [claim.converted_order?.order_number ?? "—", claim.claim_number, claim.customer_name, claim.line_name, claim.items.map((item) => `${item.product_name}${item.specification ? `（${item.specification}）` : ""} × ${item.quantity}`).join("；"), claim.claim_total, claim.converted_order?.payment_method ?? "—", claim.converted_order?.reconciliation_status ?? "—", claimStatus(claim), claim.converted_order?.delivery_method ?? "—"])];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${campaignId}-已確認訂單.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  const applyBulkStatus = async (claimsToUpdate: Claim[]) => {
    if (!claimsToUpdate.length) return setError("請至少選擇一筆已確認訂單。 ");
    const message = bulkStatus === "已出貨" ? `確認將 ${claimsToUpdate.length} 筆訂單設為已出貨？系統會逐筆扣除庫存。` : `確認將 ${claimsToUpdate.length} 筆訂單標記為「${bulkStatus}」？`;
    if (!window.confirm(message)) return;
    setBulkSaving(true); setError("");
    const failures: string[] = [];
    for (const claim of claimsToUpdate) {
      try {
        const response = bulkStatus === "已出貨"
          ? await fetch(`/api/orders/${claim.converted_order_id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete" }) })
          : await fetch(`/api/live-sale/claims/${claim.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setNotification", notificationStatus: bulkStatus }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "更新失敗。");
      } catch (reason) { failures.push(`${claim.claim_number}：${reason instanceof Error ? reason.message : "更新失敗。"}`); }
    }
    setSelectedConfirmedIds([]); await load(); setBulkSaving(false);
    if (failures.length) setError(`${failures.length} 筆未更新：${failures.join("；")}`); else setNotice(`已更新 ${claimsToUpdate.length} 筆訂單為「${bulkStatus}」。`);
  };
  const saveCampaign = async () => {
    const response = await fetch(`/api/live-sale/campaigns/${campaignId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateCampaign", name, status, startDate, endDate: endDate || undefined, note }) });
    const result = await response.json();
    if (!response.ok) setError(result.message ?? "無法更新檔期。"); else { setNotice("檔期資訊已更新。"); await load(); }
  };
  const deleteCampaign = async () => {
    if (!detail || !window.confirm(`確定刪除空白檔期「${detail.campaign.name}」嗎？`)) return;
    const response = await fetch(`/api/live-sale/campaigns/${campaignId}`, { method: "DELETE" }); const result = await response.json();
    if (!response.ok) setError(result.message ?? "無法刪除檔期。"); else await onDeleted();
  };

  if (loading) return <p className="py-10 text-center text-sm text-[#8D877E]">載入連線檔期中…</p>;
  if (!detail) return <><button onClick={back} className="text-sm font-semibold text-[#5E7665]">← 返回連線檔期</button><p className="mt-5 text-sm text-[#A35F37]">{error || "找不到連線檔期。"}</p></>;
  if (editor) return <ClaimEditor campaignId={campaignId} catalog={catalog} customers={customers} initial={editor.claim} inbox={editor.inbox} onCancel={() => setEditor(null)} onSaved={async () => { setEditor(null); setNotice(editor.claim ? "喊單已更新；同客戶的未結帳喊單已自動合併。" : "已建立／合併喊單。" ); await load(); }} onAction={action} openOrder={openOrder} onCustomerCreated={(customer) => { setCustomers((current) => [customer, ...current.filter((item) => item.id !== customer.id)]); setCustomersLoaded(true); }} />;

  const { campaign, claims, summary, procurement } = detail;
  const visibleClaims = claims.filter((claim) => claimTab === "confirmed" ? claim.status === "已轉訂單" : claim.status !== "已轉訂單");
  const confirmedClaims = claims.filter((claim) => claim.status === "已轉訂單");
  const selectedConfirmedClaims = confirmedClaims.filter((claim) => selectedConfirmedIds.includes(claim.id));
  const allConfirmedSelected = Boolean(confirmedClaims.length) && confirmedClaims.every((claim) => selectedConfirmedIds.includes(claim.id));
  return <>
    {claimTab === "confirmed" && <section className="mb-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EDE8] p-5"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CONFIRMED ORDER ACTIONS</p><h2 className="mt-1 text-lg font-semibold">已確認訂單批量作業</h2><p className="mt-1 text-xs text-[#8D877E]">通知狀態可直接更新；改為已出貨時會逐筆扣庫存。</p></div><div className="flex flex-wrap gap-2"><button onClick={() => exportConfirmed(selectedConfirmedClaims)} disabled={!selectedConfirmedClaims.length} className={secondary}>批量匯出訂單</button><select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as NotificationStatus | "已出貨")} className="h-10 rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665]"><option>未通知</option><option>已通知</option><option>已出貨</option></select><button onClick={() => void applyBulkStatus(selectedConfirmedClaims)} disabled={!selectedConfirmedClaims.length || bulkSaving} className={button}>{bulkSaving ? "更新中…" : "修改訂單狀況"}</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-left text-sm"><thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]"><tr><th className="w-12 px-5 py-3"><input aria-label="選取全部已確認訂單" type="checkbox" checked={allConfirmedSelected} onChange={() => setSelectedConfirmedIds(allConfirmedSelected ? [] : confirmedClaims.map((claim) => claim.id))} /></th><th className="px-3 py-3">訂單編號</th><th className="px-3 py-3">客戶</th><th className="px-3 py-3">訂單狀況</th><th className="px-3 py-3">付款方式</th><th className="px-3 py-3">付款狀態</th><th className="px-3 py-3">總金額</th><th className="px-5 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-[#F0EDE8]">{confirmedClaims.map((claim) => <tr key={claim.id}><td className="px-5 py-4"><input aria-label={`選取 ${claim.claim_number}`} type="checkbox" checked={selectedConfirmedIds.includes(claim.id)} onChange={() => setSelectedConfirmedIds((current) => current.includes(claim.id) ? current.filter((id) => id !== claim.id) : [...current, claim.id])} /></td><td className="px-3 py-4 font-semibold">{claim.converted_order?.order_number ?? claim.claim_number}</td><td className="px-3 py-4">{claim.customer_name || "未配對客戶"}</td><td className="px-3 py-4"><ConfirmedStatusPill claim={claim} /></td><td className="px-3 py-4">{claim.converted_order?.payment_method ?? "—"}</td><td className="px-3 py-4"><Pill status={claim.converted_order?.reconciliation_status === "已付款" ? "已結帳" : "待結帳"} /></td><td className="px-3 py-4 font-semibold">{money(claim.claim_total)}</td><td className="px-5 py-4 text-right">{claim.converted_order_id && <button onClick={() => openOrder(claim.converted_order_id!)} className="text-sm font-semibold text-[#5E7665]">查看／修改 →</button>}</td></tr>)}{!confirmedClaims.length && <tr><td colSpan={8} className="p-10 text-center text-[#8D877E]">尚無已確認訂單。</td></tr>}</tbody></table></div></section>}
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><button onClick={back} className="text-sm font-semibold text-[#5E7665]">← 返回連線檔期</button><p className="mt-5 text-[11px] font-bold tracking-[.18em] text-[#A09A90]">LIVE SALE CAMPAIGN</p><h1 className="mt-2 text-[29px] font-semibold">{campaign.name}</h1><p className="mt-2 text-sm text-[#7B766E]">檔期編號 {campaign.campaign_code} · {day(campaign.start_date)} 開始</p></div><button onClick={() => void openEditor({ inbox: null })} disabled={campaign.status === "已封存" || opening} className={button}>{opening ? "準備中…" : "＋ 建立喊單"}</button></div>
    {error && <p className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] p-3 text-sm text-[#A35F37]">{error}</p>}{notice && <p className="mb-5 rounded-xl border border-[#D9E5DB] bg-[#EEF5EF] p-3 text-sm text-[#477154]">{notice}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="目前連線業績" value={money(summary.activeAmount)} note="未取消喊單總額"/><Metric label="已結帳" value={money(summary.paidAmount)} note="人員已確認收款"/><Metric label="待結帳" value={money(summary.pendingAmount)} note="完成核對、等待結帳"/><Metric label="喊單筆數" value={`${summary.claimCount} 筆`} note={summary.unresolvedCount ? `${summary.unresolvedCount} 筆待核對` : "皆已核對"}/><Metric label="採購商品" value={`${procurement.length} 項`} note="依商品與規格彙整"/></div>
    <section className="mt-5 rounded-2xl border border-[#E9E5DF] bg-white p-5"><div className="grid gap-4 lg:grid-cols-4"><label className="text-sm font-semibold">檔期名稱<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal" /></label><label className="text-sm font-semibold">開始日期<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal" /></label><label className="text-sm font-semibold">結束日期<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal" /></label><label className="text-sm font-semibold">檔期狀態<select value={status} onChange={(event) => setStatus(event.target.value as Campaign["status"])} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal"><option>進行中</option><option>已結單</option><option>已封存</option></select></label><label className="text-sm font-semibold lg:col-span-3">檔期備註<input value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal" /></label><div className="flex items-end justify-end gap-2"><button onClick={() => void saveCampaign()} className={secondary}>儲存檔期設定</button><button onClick={() => void deleteCampaign()} disabled={summary.claimCount > 0} className="inline-flex h-10 items-center rounded-xl border border-[#F0D6C2] bg-white px-3 text-sm font-semibold text-[#A35F37] disabled:opacity-45">刪除空白檔期</button></div></div></section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EDE8] p-5"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CLAIMS</p><h2 className="mt-1 text-lg font-semibold">{claimTab === "confirmed" ? "已確認訂單" : "未結帳喊單"}</h2></div><div className="flex gap-2"><button onClick={() => setClaimTab("open")} className={claimTab === "open" ? button : secondary}>未結帳喊單</button><button onClick={() => setClaimTab("confirmed")} className={claimTab === "confirmed" ? button : secondary}>已確認訂單</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]"><tr><th className="px-5 py-3">喊單編號</th><th className="px-3 py-3">客戶名稱</th><th className="px-3 py-3">訂單狀態</th><th className="px-3 py-3">總金額</th><th className="px-3 py-3">訂單淨利</th><th className="px-5 py-3 text-right">完整訂單</th></tr></thead><tbody className="divide-y divide-[#F0EDE8]">{visibleClaims.length ? visibleClaims.map((claim) => { const claimProfit = claim.items.reduce<number | null>((sum, item) => { const product = item.product_id ? catalogById.get(item.product_id) : undefined; return sum === null || !product ? null : sum + (item.unit_price - product.cost) * item.quantity; }, 0); return <tr key={claim.id}><td className="px-5 py-4 font-semibold">{claim.claim_number}</td><td className="px-3 py-4">{claim.customer_name || "未配對客戶"}</td><td className="px-3 py-4"><Pill status={claim.status} /></td><td className="px-3 py-4 font-semibold">{money(claim.claim_total)}</td><td className={`px-3 py-4 font-semibold ${claimProfit === null ? "text-[#928C83]" : claimProfit < 0 ? "text-[#A66932]" : "text-[#477154]"}`}>{claimProfit === null ? "待核對" : money(claimProfit)}</td><td className="px-5 py-4 text-right">{claim.status === "已轉訂單" && claim.converted_order_id ? <button onClick={() => openOrder(claim.converted_order_id!)} className="text-sm font-semibold text-[#5E7665]">編輯訂單 →</button> : <button onClick={() => void openEditor({ claim })} className="text-sm font-semibold text-[#5E7665]">展開完整訂單 →</button>}</td></tr>; }) : <tr><td colSpan={6} className="p-10 text-center text-[#8D877E]">{claimTab === "confirmed" ? "尚無已確認訂單。" : "尚未建立未結帳喊單。"}</td></tr>}</tbody></table></div></section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white"><div className="border-b border-[#F0EDE8] p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PURCHASING SUMMARY</p><h2 className="mt-1 text-lg font-semibold">商品採購與缺貨統整</h2><p className="mt-1 text-xs text-[#8D877E]">需求量統計未取消喊單；商品資料庫的可售庫存會自動同步，需採購為需求量扣除可售庫存。</p></div><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]"><tr><th className="px-5 py-3">商品／規格</th><th className="px-3 py-3">喊單需求</th><th className="px-3 py-3">商品資料庫可售庫存</th><th className="px-3 py-3">需採購</th><th className="px-3 py-3">已結帳</th><th className="px-3 py-3">待核對</th><th className="px-3 py-3">目前不足／需通知客人</th></tr></thead><tbody className="divide-y divide-[#F0EDE8]">{procurement.length ? procurement.map((line) => <tr key={line.productId ?? `${line.productName}-${line.specification}`}><td className="px-5 py-4"><b>{line.productName}</b><small className="mt-1 block text-xs text-[#8D877E]">{[line.category, line.specification].filter(Boolean).join(" · ") || "待確認商品"}</small></td><td className="px-3 py-4 font-semibold">{line.demandQuantity}</td><td className="px-3 py-4">{line.availableQuantity === null ? "待核對商品" : line.availableQuantity}</td><td className="px-3 py-4 font-semibold text-[#A35F37]">{line.purchaseQuantity === null ? "—" : line.purchaseQuantity}</td><td className="px-3 py-4 text-[#477154]">{line.paidQuantity}</td><td className="px-3 py-4 text-[#A66932]">{line.unresolvedQuantity || "—"}</td><td className="px-3 py-4">{line.shortageQuantity === null ? <span className="text-[#8D877E]">請先核對商品</span> : line.shortageQuantity ? <div><b className="text-[#A35F37]">缺 {line.shortageQuantity}</b><p className="mt-1 max-w-xs text-xs text-[#7E6657]">{line.affectedCustomers.map((person) => `${person.customerName}（${person.quantity}）`).join("、")}</p></div> : <span className="font-semibold text-[#477154]">供應足夠</span>}</td></tr>) : <tr><td colSpan={7} className="p-10 text-center text-[#8D877E]">建立喊單後，這裡會依商品規格自動統整採購數量。</td></tr>}</tbody></table></div></section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white"><div className="border-b border-[#F0EDE8] p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">LINE DIRECT MESSAGES</p><h2 className="mt-1 text-lg font-semibold">待確認 LINE 私訊</h2><p className="mt-1 text-xs text-[#8D877E]">尚未辨識客戶或商品的訊息會留在這裡；完成配對後會自動併入同檔期、同客戶的未結帳喊單。</p></div>{inbox.length ? <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{inbox.map((item) => <article key={item.id} className="rounded-xl border border-[#E9E5DF] bg-[#FCFBF9] p-4"><p className="whitespace-pre-wrap text-sm font-semibold">{item.message_text}</p><p className="mt-3 text-xs text-[#8D877E]">{item.matched_customer ? `已配對：${item.matched_customer.name}` : "尚未配對客戶"}</p><button onClick={() => void openEditor({ inbox: item })} className="mt-3 text-sm font-semibold text-[#5E7665]">建立／核對喊單 →</button></article>)}</div> : <p className="p-8 text-center text-sm text-[#8D877E]">目前沒有待處理的 LINE 私訊。</p>}</section>
  </>;
}

export function LiveSalePage({ catalog, openOrder, back }: { catalog: Product[]; openOrder: (id: string) => void; back: () => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: "", campaignCode: "", startDate: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }), endDate: "", note: "" });
  const load = async () => {
    setLoading(true);
    try { const response = await fetch("/api/live-sale/campaigns"); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "無法讀取連線檔期。"); setCampaigns(result.campaigns ?? []); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "無法讀取連線檔期。"); } finally { setLoading(false); }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
    // 首次進入時載入連線檔期清單。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const create = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { const response = await fetch("/api/live-sale/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) }); const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "無法建立連線檔期。"); setCreating(false); setSelected(result.campaign.id); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "無法建立連線檔期。"); } finally { setSaving(false); }
  };
  if (selected) return <CampaignDetailPage campaignId={selected} catalog={catalog} openOrder={openOrder} back={() => { setSelected(""); void load(); }} onDeleted={async () => { setSelected(""); await load(); }} />;
  return <><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><button onClick={back} className="text-sm font-semibold text-[#5E7665]">← 返回一般訂單</button><p className="mt-5 text-[11px] font-bold tracking-[.18em] text-[#A09A90]">LIVE SALES</p><h1 className="mt-2 text-[29px] font-semibold">連線檔期</h1><p className="mt-2 text-sm text-[#7B766E]">LINE 私訊喊單與一般訂單分開管理；確認結帳後會建立連線專用訂單並保留在本檔期。</p></div><button onClick={() => setCreating((value) => !value)} className={button}>＋ 新增連線檔期</button></div>{error && <p className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] p-3 text-sm text-[#A35F37]">{error}</p>}{creating && <form onSubmit={create} className="mb-5 rounded-2xl border border-[#D9E5DB] bg-[#F6FAF6] p-5"><h2 className="text-lg font-semibold">建立連線檔期資料夾</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-semibold">檔期名稱<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal" /></label><label className="text-sm font-semibold">獨立檔期編號<input required value={draft.campaignCode} onChange={(event) => setDraft({ ...draft, campaignCode: event.target.value.toUpperCase() })} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal" /></label><label className="text-sm font-semibold">開始日期<input required type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal" /></label><label className="text-sm font-semibold">結單日期<input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal" /></label></div><label className="mt-4 block text-sm font-semibold">檔期備註<input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCreating(false)} className={secondary}>取消</button><button disabled={saving} className={button}>{saving ? "建立中…" : "建立檔期"}</button></div></form>}<section className="overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white"><div className="border-b border-[#F0EDE8] p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CAMPAIGN FOLDERS</p><h2 className="mt-1 text-lg font-semibold">連線檔期列表</h2></div>{loading ? <p className="p-10 text-center text-sm text-[#8D877E]">載入連線檔期中…</p> : campaigns.length ? <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{campaigns.map((campaign) => <button key={campaign.id} onClick={() => setSelected(campaign.id)} className="rounded-2xl border border-[#E9E5DF] bg-[#FCFBF9] p-5 text-left hover:border-[#B7CEBA]"><p className="text-[11px] font-bold tracking-[.16em] text-[#8F998F]">{campaign.campaign_code}</p><h3 className="mt-2 text-lg font-semibold">{campaign.name}</h3><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="連線業績" value={money(campaign.summary.activeAmount)} note="未取消喊單"/><Metric label="已結帳" value={money(campaign.summary.paidAmount)} note={`${campaign.summary.claimCount} 筆喊單`}/></div><p className="mt-4 text-xs text-[#8D877E]">{day(campaign.start_date)} 起</p></button>)}</div> : <p className="p-10 text-center text-sm text-[#8D877E]">尚未建立連線檔期。</p>}</section></>;
}
