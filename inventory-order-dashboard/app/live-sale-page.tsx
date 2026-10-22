"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Product = {
  id: string | number;
  sku: string;
  name: string;
  country: string;
  category: string;
  subcategory: string;
  specification: string;
  retailPrice: number;
};

type Customer = {
  id: string;
  name: string;
  line_name: string;
  customer_category: "員工" | "社群";
  preferred_delivery_method: "自取" | "賣貨便";
};

type CampaignSummary = { claimCount: number; activeAmount: number; paidAmount: number; pendingAmount: number; unresolvedCount: number };
type Campaign = {
  id: string;
  name: string;
  campaign_code: string;
  status: "進行中" | "已結單" | "已封存";
  start_date: string;
  end_date: string | null;
  note: string;
  created_at: string;
  summary: CampaignSummary;
};
type ClaimItem = { id?: string; product_id: string | null; product_name: string; category: string; specification: string; unit_price: number; quantity: number };
type Claim = {
  id: string;
  claim_number: string;
  customer_id: string | null;
  customer_name: string;
  line_name: string;
  community_name: string;
  source_inbox_id: string | null;
  status: "待核對" | "待結帳" | "已結帳" | "已轉訂單" | "已取消";
  claim_total: number;
  note: string;
  payment_marked_at: string | null;
  payment_marked_by: string;
  converted_order_id: string | null;
  created_at: string;
  items: ClaimItem[];
};
type Procurement = {
  productId: string | null;
  productName: string;
  specification: string;
  category: string;
  demandQuantity: number;
  paidQuantity: number;
  unresolvedQuantity: number;
  availableQuantity: number | null;
  availabilityNote: string;
  shortageQuantity: number | null;
  affectedCustomers: Array<{ claimId: string; claimNumber: string; customerName: string; communityName: string; quantity: number }>;
};
type Notebook = { id: string; name: string; url: string; note: string; created_at: string };
type CampaignDetail = { campaign: Campaign; claims: Claim[]; summary: CampaignSummary; procurement: Procurement[]; notebooks: Notebook[] };
type Inbox = {
  id: string;
  status: "待處理" | "已建立喊單" | "已略過";
  received_at: string;
  screenshot_url: string;
  matched_customer: { id: string; name: string; line_name: string } | null;
};
type DraftLine = { key: string; productId: string; productName: string; specification: string; unitPrice: number; quantity: number };

const currency = (value: number) => `NT$ ${Number(value || 0).toLocaleString("zh-TW")}`;
const dateTime = (value: string) => new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Taipei" }).format(new Date(value));
const dateOnly = (value: string | null) => value ? value.replaceAll("-", "/") : "—";
const outline = "inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665] disabled:cursor-not-allowed disabled:opacity-45";
const primary = "inline-flex h-10 items-center justify-center rounded-xl bg-[#292824] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45";
const statusTone: Record<Claim["status"], string> = {
  "待核對": "bg-[#FAECDD] text-[#A66932]",
  "待結帳": "bg-[#E5EEF2] text-[#4B6D79]",
  "已結帳": "bg-[#E7F0E8] text-[#477154]",
  "已轉訂單": "bg-[#E9E6F4] text-[#625184]",
  "已取消": "bg-[#F0EDE8] text-[#6F6960]",
};

function newLine(): DraftLine {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, productId: "", productName: "", specification: "", unitPrice: 0, quantity: 1 };
}

function Metric({ label, value, note, accent }: { label: string; value: string; note: string; accent?: boolean }) {
  return <div className={`rounded-xl border p-4 ${accent ? "border-[#D9E5DB] bg-[#F2F7F2]" : "border-[#EAE6E0] bg-[#FCFBF9]"}`}><p className="text-xs font-semibold text-[#837D73]">{label}</p><p className={`mt-2 text-xl font-semibold tracking-[-.04em] ${accent ? "text-[#406248]" : "text-[#302E2A]"}`}>{value}</p><p className="mt-1 text-xs text-[#938D84]">{note}</p></div>;
}

function ClaimPill({ status }: { status: Claim["status"] }) {
  return <span className={`inline-flex min-h-6 items-center justify-center rounded-full px-2.5 py-1 text-center text-[11px] font-semibold leading-none ${statusTone[status]}`}>{status}</span>;
}

function ClaimEditor({ campaignId, catalog, customers, initial, inbox, onCancel, onSaved }: {
  campaignId: string;
  catalog: Product[];
  customers: Customer[];
  initial?: Claim;
  inbox?: Inbox | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? inbox?.matched_customer?.id ?? "");
  const [communityName, setCommunityName] = useState(initial?.community_name ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [lines, setLines] = useState<DraftLine[]>(initial?.items.length ? initial.items.map((item) => ({ key: item.id ?? newLine().key, productId: item.product_id ?? "", productName: item.product_name, specification: item.specification, unitPrice: item.unit_price, quantity: item.quantity })) : [newLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const socialCustomers = customers.filter((customer) => customer.customer_category === "社群");
  const total = lines.reduce((sum, line) => sum + Math.max(0, line.unitPrice || 0) * Math.max(0, line.quantity || 0), 0);

  const editLine = (key: string, patch: Partial<DraftLine>) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  const chooseProduct = (key: string, productId: string) => {
    const product = catalog.find((item) => String(item.id) === productId);
    editLine(key, product ? { productId, productName: product.name, specification: product.specification, unitPrice: product.retailPrice } : { productId: "" });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        customerId: customerId || undefined,
        communityName,
        note,
        sourceInboxId: initial?.source_inbox_id ?? inbox?.id ?? undefined,
        items: lines.map((line) => ({ productId: line.productId || undefined, productName: line.productName, specification: line.specification, unitPrice: line.unitPrice, quantity: line.quantity })),
      };
      const response = await fetch(initial ? `/api/live-sale/claims/${initial.id}` : `/api/live-sale/campaigns/${campaignId}/claims`, {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(initial ? { action: "update", ...payload } : payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法儲存喊單。 ");
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法儲存喊單。 ");
    } finally {
      setSaving(false);
    }
  };

  return <form onSubmit={save} className="rounded-2xl border border-[#D9E5DB] bg-[#F8FBF8] p-5 sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#709176]">{initial ? "EDIT CLAIM" : "NEW CLAIM"}</p><h3 className="mt-1 text-lg font-semibold">{initial ? `修改喊單 ${initial.claim_number}` : "由記事本截圖建立喊單"}</h3><p className="mt-1 text-xs leading-5 text-[#738076]">未辨識到的商品可先手動輸入；完成客戶與商品核對後會轉為待結帳。</p></div><button type="button" onClick={onCancel} className={outline}>取消</button></div>
    {inbox && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#DEE8DF] bg-white p-3"><img src={inbox.screenshot_url} alt="LINE 記事本截圖" className="h-16 w-16 rounded-lg border border-[#E8E4DD] object-cover" /><span className="text-xs leading-5 text-[#6C756D]">LINE 截圖已連結。{inbox.matched_customer ? `已帶入客戶：${inbox.matched_customer.name}${inbox.matched_customer.line_name ? ` · ${inbox.matched_customer.line_name}` : ""}` : "請確認社群名稱與客戶 LINE@ 資料。"}</span></div>}
    {error && <p role="alert" className="mt-4 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] px-3 py-2 text-sm font-semibold text-[#9B562A]">{error}</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#58534C]">社群記事本名稱<input required value={communityName} onChange={(event) => setCommunityName(event.target.value)} placeholder="客人在記事本使用的名稱" className="mt-2 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#58534C]">客戶／LINE@ 名稱<select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none"><option value="">尚未配對，保留待核對</option>{socialCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.line_name ? ` · ${customer.line_name}` : ""}</option>)}</select></label></div>
    <section className="mt-5 overflow-hidden rounded-xl border border-[#E6E2DC] bg-white"><div className="flex items-center justify-between border-b border-[#EFECE7] px-4 py-3"><b className="text-sm">喊單商品</b><button type="button" onClick={() => setLines((current) => [...current, newLine()])} className="text-sm font-semibold text-[#5E7665]">＋ 加入商品</button></div><div className="space-y-3 p-4">{lines.map((line, index) => <div key={line.key} className="grid gap-2 rounded-xl border border-[#EEEAE4] bg-[#FCFBF9] p-3 lg:grid-cols-[minmax(0,1fr)_130px_90px_76px_36px] lg:items-end"><label className="text-xs font-semibold text-[#777168]">商品資料庫<select value={line.productId} onChange={(event) => chooseProduct(line.key, event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#E2DED8] bg-white px-2 text-sm font-normal outline-none"><option value="">手動輸入／待建立商品</option>{catalog.map((product) => <option key={product.id} value={String(product.id)}>{product.sku}｜{product.name}{product.specification ? `｜${product.specification}` : ""}</option>)}</select></label><label className="text-xs font-semibold text-[#777168]">商品名稱<input required value={line.productName} onChange={(event) => editLine(line.key, { productName: event.target.value, productId: "" })} placeholder="商品名稱" className="mt-1 h-9 w-full rounded-lg border border-[#E2DED8] bg-white px-2 text-sm font-normal outline-none" /></label><label className="text-xs font-semibold text-[#777168]">規格<input value={line.specification} onChange={(event) => editLine(line.key, { specification: event.target.value })} placeholder="規格" className="mt-1 h-9 w-full rounded-lg border border-[#E2DED8] bg-white px-2 text-sm font-normal outline-none" /></label><label className="text-xs font-semibold text-[#777168]">單價／數量<span className="mt-1 flex gap-1"><input aria-label={`${index + 1} 單價`} type="number" min="0" value={line.unitPrice} onChange={(event) => editLine(line.key, { unitPrice: Math.max(0, Number(event.target.value) || 0) })} className="h-9 min-w-0 w-full rounded-lg border border-[#E2DED8] bg-white px-2 text-sm font-normal outline-none" /><input aria-label={`${index + 1} 數量`} type="number" min="1" value={line.quantity} onChange={(event) => editLine(line.key, { quantity: Math.max(1, Number(event.target.value) || 1) })} className="h-9 w-12 rounded-lg border border-[#E2DED8] bg-white px-2 text-sm font-normal outline-none" /></span></label><button aria-label={`移除第 ${index + 1} 項商品`} type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} className="h-9 rounded-lg text-lg text-[#A35F37] disabled:opacity-30">×</button></div>)}</div></section>
    <label className="mt-5 block text-sm font-semibold text-[#58534C]">內部備註<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="可記錄記事本位置、商品狀況或與客人確認事項" className="mt-2 min-h-20 w-full rounded-xl border border-[#E6E1DB] bg-white p-3 text-sm font-normal outline-none" /></label>
    <div className="mt-5 flex flex-col gap-3 border-t border-[#DFE6E0] pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-[#5D685F]">喊單金額 <b className="ml-2 text-lg text-[#36563D]">{currency(total)}</b></p><button type="submit" disabled={saving} className={primary}>{saving ? "儲存中…" : initial ? "儲存修改" : "建立待核對喊單"}</button></div>
  </form>;
}

function CampaignDetailPage({ campaignId, catalog, openOrder, back, onDeleted }: { campaignId: string; catalog: Product[]; openOrder: (id: string) => void; back: () => void; onDeleted: () => Promise<void> }) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [inbox, setInbox] = useState<Inbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingEditor, setOpeningEditor] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{ claim?: Claim; inbox?: Inbox | null } | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [campaignStatus, setCampaignStatus] = useState<Campaign["status"]>("進行中");
  const [campaignStartDate, setCampaignStartDate] = useState("");
  const [campaignNote, setCampaignNote] = useState("");
  const [campaignEndDate, setCampaignEndDate] = useState("");
  const [supplyInputs, setSupplyInputs] = useState<Record<string, string>>({});
  const [notebookDraft, setNotebookDraft] = useState({ name: "", url: "", note: "" });
  const [notebookSaving, setNotebookSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [detailResponse, inboxResponse] = await Promise.all([fetch(`/api/live-sale/campaigns/${campaignId}`), fetch("/api/live-sale/inbox?status=%E5%BE%85%E8%99%95%E7%90%86")]);
      const [detailResult, inboxResult] = await Promise.all([detailResponse.json(), inboxResponse.json()]);
      if (!detailResponse.ok) throw new Error(detailResult.message ?? "無法讀取連線檔期。 ");
      if (!inboxResponse.ok) throw new Error(inboxResult.message ?? "無法讀取 LINE 截圖收件匣。 ");
      const nextDetail = detailResult as CampaignDetail;
      setDetail(nextDetail);
      setInbox((inboxResult.inbox ?? []) as Inbox[]);
      setCampaignName(nextDetail.campaign.name);
      setCampaignStatus(nextDetail.campaign.status);
      setCampaignStartDate(nextDetail.campaign.start_date);
      setCampaignNote(nextDetail.campaign.note);
      setCampaignEndDate(nextDetail.campaign.end_date ?? "");
      setSupplyInputs(Object.fromEntries(nextDetail.procurement.filter((line) => line.productId).map((line) => [line.productId as string, line.availableQuantity === null ? "" : String(line.availableQuantity)])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法讀取連線檔期。 ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setCustomers([]); setCustomersLoaded(false); void load(); }, [campaignId]);

  const loadCustomers = async () => {
    if (customersLoaded) return;
    const response = await fetch("/api/customers");
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "無法讀取客戶資料。 ");
    setCustomers((result.customers ?? []) as Customer[]);
    setCustomersLoaded(true);
  };

  const openEditor = async (nextEditor: { claim?: Claim; inbox?: Inbox | null }) => {
    setError("");
    setOpeningEditor(true);
    try {
      await loadCustomers();
      setEditor(nextEditor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法讀取客戶資料。 ");
    } finally {
      setOpeningEditor(false);
    }
  };

  const changeClaimStatus = async (claim: Claim, action: "markPaid" | "markUnpaid" | "cancel" | "restore" | "convert") => {
    const confirmations: Partial<Record<typeof action, string>> = {
      markPaid: `確認將 ${claim.claim_number} 標記為已結帳？`,
      convert: `確認把 ${claim.claim_number} 轉為一般訂單？系統會建立一筆預購中、已付款的一般訂單，後續出貨流程與常態訂單相同。`,
      cancel: `確定取消 ${claim.claim_number}？`,
    };
    if (confirmations[action] && !window.confirm(confirmations[action])) return;
    setError(""); setNotice("");
    try {
      const response = await fetch(`/api/live-sale/claims/${claim.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法更新喊單。 ");
      if (action === "convert") setNotice(`已建立一般訂單 ${result.order?.order_number ?? ""}；原連線喊單仍保留於此檔期。`);
      else setNotice(action === "markPaid" ? "已標記為已結帳。" : "喊單狀態已更新。 ");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法更新喊單。 "); }
  };

  const saveCampaign = async () => {
    setError(""); setNotice("");
    try {
      const response = await fetch(`/api/live-sale/campaigns/${campaignId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateCampaign", name: campaignName, status: campaignStatus, startDate: campaignStartDate, note: campaignNote, endDate: campaignEndDate || undefined }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法更新檔期。 ");
      setNotice("檔期資訊已更新。 ");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法更新檔期。 "); }
  };

  const saveNotebook = async (event: FormEvent) => {
    event.preventDefault();
    setNotebookSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/live-sale/campaigns/${campaignId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "addNotebook", ...notebookDraft }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法加入記事本連結。 ");
      setNotebookDraft({ name: "", url: "", note: "" });
      setNotice("社群記事本連結已加入。 ");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法加入記事本連結。 ");
    } finally {
      setNotebookSaving(false);
    }
  };

  const removeNotebook = async (notebook: Notebook) => {
    if (!window.confirm(`確定移除「${notebook.name}」的記事本連結嗎？這不會影響 LINE 社群或喊單資料。`)) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/live-sale/campaigns/${campaignId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteNotebook", notebookId: notebook.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法移除記事本連結。 ");
      setNotice("社群記事本連結已移除。 ");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法移除記事本連結。 ");
    }
  };

  const deleteCampaign = async () => {
    if (!detail) return;
    if (!window.confirm(`確定刪除空白檔期「${detail.campaign.name}」嗎？此動作只會刪除這個檔期資料夾，無法復原。`)) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/live-sale/campaigns/${campaignId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法刪除連線檔期。 ");
      await onDeleted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法刪除連線檔期。 ");
    }
  };

  const saveSupply = async (line: Procurement) => {
    if (!line.productId) return;
    const raw = supplyInputs[line.productId] ?? "";
    setError("");
    try {
      const response = await fetch(`/api/live-sale/campaigns/${campaignId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateSupply", productId: line.productId, availableQuantity: raw === "" ? null : Number(raw), note: line.availabilityNote }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法儲存可供應數量。 ");
      setNotice("可供應數量已更新。 ");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法儲存可供應數量。 "); }
  };

  if (loading) return <p className="py-10 text-center text-sm text-[#8D877E]">載入連線檔期中…</p>;
  if (!detail) return <><button onClick={back} className="text-sm font-semibold text-[#5E7665]">← 返回連線檔期</button><p role="alert" className="mt-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] p-4 text-sm font-semibold text-[#9B562A]">{error || "找不到連線檔期。"}</p></>;
  const { campaign, summary, claims, procurement, notebooks } = detail;

  return <>
    <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><button onClick={back} className="text-sm font-semibold text-[#5E7665]">← 返回連線檔期</button><p className="mt-5 text-[11px] font-bold tracking-[.18em] text-[#A09A90]">LIVE SALE CAMPAIGN</p><h1 className="mt-2 text-[29px] font-semibold tracking-[-.055em]">{campaign.name}</h1><p className="mt-2 text-sm text-[#7B766E]">檔期編號 {campaign.campaign_code} · {dateOnly(campaign.start_date)} 開始</p></div><div className="flex flex-wrap gap-2"><button onClick={() => { void openEditor({ inbox: null }); }} disabled={campaign.status === "已封存" || openingEditor} className={primary}>{openingEditor ? "準備中…" : "＋ 建立喊單"}</button><button onClick={back} className={outline}>一般訂單管理</button></div></div>
    {error && <p role="alert" className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] px-4 py-3 text-sm font-semibold text-[#9B562A]">{error}</p>}
    {notice && <p role="status" className="mb-5 rounded-xl border border-[#D9E5DB] bg-[#EEF5EF] px-4 py-3 text-sm font-semibold text-[#477154]">{notice}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="目前連線業績" value={currency(summary.activeAmount)} note="未取消喊單總額" accent/><Metric label="已結帳" value={currency(summary.paidAmount)} note="人員已確認收款"/><Metric label="待結帳" value={currency(summary.pendingAmount)} note="完成核對、等待私訊結帳"/><Metric label="喊單筆數" value={`${summary.claimCount} 筆`} note={summary.unresolvedCount ? `${summary.unresolvedCount} 筆待核對` : "皆已完成初步核對"}/><Metric label="採購商品" value={`${procurement.length} 項`} note="依商品與規格彙整"/></div>
    <section className="mt-5 rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6"><div className="grid gap-4 lg:grid-cols-4"><label className="text-sm font-semibold text-[#58534C]">檔期名稱<input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#58534C]">開始日期<input type="date" value={campaignStartDate} onChange={(event) => setCampaignStartDate(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#58534C]">結束日期<input type="date" value={campaignEndDate} onChange={(event) => setCampaignEndDate(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#58534C]">檔期狀態<select value={campaignStatus} onChange={(event) => setCampaignStatus(event.target.value as Campaign["status"])} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"><option>進行中</option><option>已結單</option><option>已封存</option></select></label><label className="text-sm font-semibold text-[#58534C] lg:col-span-3">檔期備註<input value={campaignNote} onChange={(event) => setCampaignNote(event.target.value)} placeholder="例如：10/30 晚上結單，先採購後統一結帳" className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none" /></label><div className="flex flex-wrap items-end justify-end gap-2"><button onClick={() => { void saveCampaign(); }} className={outline}>儲存檔期設定</button><button onClick={() => { void deleteCampaign(); }} disabled={summary.claimCount > 0} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#F0D6C2] bg-white px-3 text-sm font-semibold text-[#A35F37] disabled:cursor-not-allowed disabled:opacity-45">刪除空白檔期</button></div></div><p className="mt-4 text-xs text-[#8D877E]">檔期編號 {campaign.campaign_code} 會保留作為喊單編號依據；已有喊單的檔期為保留歷史不可刪除，可改為封存。</p></section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
      <div className="border-b border-[#F0EDE8] px-5 py-5 sm:px-6">
        <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">COMMUNITY NOTEPADS</p>
        <h2 className="mt-1 text-lg font-semibold">社群記事本連結</h2>
        <p className="mt-1 text-xs leading-5 text-[#8D877E]">同一檔期可連結多個社群記事本，方便辨識喊單來源。系統只保存連結與內部備註，不會讀取或同步記事本內容。</p>
      </div>
      <div className="p-5 sm:p-6">
        {notebooks.length ? <div className="grid gap-3 lg:grid-cols-2">{notebooks.map((notebook) => <article key={notebook.id} className="rounded-xl border border-[#E9E5DF] bg-[#FCFBF9] p-4"><div className="flex gap-3"><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{notebook.name}</h3><a href={notebook.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs font-semibold text-[#5E7665] underline underline-offset-2">開啟 LINE 記事本 ↗</a>{notebook.note && <p className="mt-3 text-xs leading-5 text-[#756F67]">{notebook.note}</p>}</div><button type="button" aria-label={`移除 ${notebook.name} 記事本連結`} onClick={() => { void removeNotebook(notebook); }} className="shrink-0 text-sm font-semibold text-[#A35F37]">移除</button></div></article>)}</div> : <p className="rounded-xl border border-dashed border-[#E5E0D9] bg-[#FCFBF9] px-4 py-5 text-center text-sm text-[#8D877E]">尚未加入社群記事本連結。</p>}
        <form onSubmit={(event) => { void saveNotebook(event); }} className="mt-5 grid gap-3 rounded-xl border border-[#E7E2DC] bg-[#FAFCFA] p-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.35fr)_minmax(0,1fr)_auto] lg:items-end">
          <label className="text-xs font-semibold text-[#676159]">記事本名稱<input required maxLength={80} value={notebookDraft.name} onChange={(event) => setNotebookDraft((current) => ({ ...current, name: event.target.value }))} placeholder="例如：第一波喊單" className="mt-1.5 h-10 w-full rounded-lg border border-[#E3DED7] bg-white px-3 text-sm font-normal outline-none" /></label>
          <label className="text-xs font-semibold text-[#676159]">LINE 記事本連結<input required type="url" value={notebookDraft.url} onChange={(event) => setNotebookDraft((current) => ({ ...current, url: event.target.value }))} placeholder="https://..." className="mt-1.5 h-10 w-full rounded-lg border border-[#E3DED7] bg-white px-3 text-sm font-normal outline-none" /></label>
          <label className="text-xs font-semibold text-[#676159]">內部備註（選填）<input maxLength={300} value={notebookDraft.note} onChange={(event) => setNotebookDraft((current) => ({ ...current, note: event.target.value }))} placeholder="例如：主帳喊單用" className="mt-1.5 h-10 w-full rounded-lg border border-[#E3DED7] bg-white px-3 text-sm font-normal outline-none" /></label>
          <button type="submit" disabled={notebookSaving} className={primary}>{notebookSaving ? "加入中…" : "＋ 加入記事本"}</button>
        </form>
      </div>
    </section>
    {editor && <section className="mt-5"><ClaimEditor campaignId={campaignId} catalog={catalog} customers={customers} initial={editor.claim} inbox={editor.inbox} onCancel={() => setEditor(null)} onSaved={async () => { setEditor(null); setNotice(editor.claim ? "喊單已更新。" : "已建立喊單；核對完成後可由人員標記結帳。 "); await load(); }} /></section>}
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white"><div className="flex flex-col gap-2 border-b border-[#F0EDE8] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">LINE INBOX</p><h2 className="mt-1 text-lg font-semibold">記事本截圖收件匣</h2><p className="mt-1 text-xs text-[#8D877E]">客人傳至官方帳號的截圖會先留在此處；第一次核對後可建立社群名稱與 LINE@ 配對。</p></div><span className="text-sm font-semibold text-[#5E7665]">待處理 {inbox.length} 張</span></div>{inbox.length ? <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{inbox.map((item) => <article key={item.id} className="overflow-hidden rounded-xl border border-[#E9E5DF] bg-[#FCFBF9]"><img src={item.screenshot_url} alt="LINE 記事本喊單截圖" className="h-44 w-full border-b border-[#E9E5DF] object-contain bg-white" /><div className="p-3"><p className="text-xs text-[#8D877E]">{dateTime(item.received_at)}</p><p className="mt-1 text-sm font-semibold">{item.matched_customer ? `已配對：${item.matched_customer.name}${item.matched_customer.line_name ? ` · ${item.matched_customer.line_name}` : ""}` : "尚未配對客戶"}</p><button onClick={() => { void openEditor({ inbox: item }); }} disabled={campaign.status === "已封存" || openingEditor} className="mt-3 text-sm font-semibold text-[#5E7665] disabled:opacity-45">{openingEditor ? "準備中…" : "由此截圖建立喊單 →"}</button></div></article>)}</div> : <p className="px-5 py-8 text-center text-sm text-[#8D877E]">目前沒有待處理的 LINE 記事本截圖。客人私訊官方帳號圖片後會顯示在這裡。</p>}</section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white"><div className="border-b border-[#F0EDE8] px-5 py-5 sm:px-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CLAIMS</p><h2 className="mt-1 text-lg font-semibold">連線喊單列表</h2><p className="mt-1 text-xs text-[#8D877E]">只有「已結帳」喊單可以手動轉為一般訂單；轉單前不會扣除一般庫存。</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1060px] text-left text-sm"><thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]"><tr><th className="px-5 py-3">喊單編號</th><th className="px-3 py-3">社群名稱／客戶</th><th className="px-3 py-3">商品</th><th className="px-3 py-3">金額</th><th className="px-3 py-3">狀態</th><th className="px-3 py-3">建立時間</th><th className="px-5 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-[#F0EDE8]">{claims.length ? claims.map((claim) => <tr key={claim.id}><td className="px-5 py-4 font-semibold">{claim.claim_number}</td><td className="px-3 py-4"><b className="block">{claim.community_name || "—"}</b><small className="mt-1 block text-xs text-[#8D877E]">{claim.customer_name || "未配對客戶"}{claim.line_name ? ` · ${claim.line_name}` : ""}</small></td><td className="px-3 py-4"><b className="block">{claim.items.map((item) => item.product_name || "待確認商品").join("、")}</b><small className="mt-1 block text-xs text-[#8D877E]">共 {claim.items.reduce((sum, item) => sum + item.quantity, 0)} 件</small></td><td className="px-3 py-4 font-semibold">{currency(claim.claim_total)}</td><td className="px-3 py-4"><ClaimPill status={claim.status} /></td><td className="px-3 py-4 text-xs text-[#777168]">{dateTime(claim.created_at)}</td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => { void openEditor({ claim }); }} disabled={claim.status === "已轉訂單" || openingEditor} className="text-sm font-semibold text-[#5E7665] disabled:opacity-40">修改</button>{claim.status === "待結帳" && <button onClick={() => { void changeClaimStatus(claim, "markPaid"); }} className="text-sm font-semibold text-[#477154]">確認結帳</button>}{claim.status === "已結帳" && <><button onClick={() => { void changeClaimStatus(claim, "convert"); }} className="text-sm font-semibold text-[#5E7665]">轉一般訂單</button><button onClick={() => { void changeClaimStatus(claim, "markUnpaid"); }} className="text-sm font-semibold text-[#8A6A36]">回待結帳</button></>}{claim.status === "已轉訂單" && claim.converted_order_id && <button onClick={() => openOrder(claim.converted_order_id as string)} className="text-sm font-semibold text-[#5E7665]">查看訂單</button>}{claim.status === "已取消" ? <button onClick={() => { void changeClaimStatus(claim, "restore"); }} className="text-sm font-semibold text-[#5E7665]">復原</button> : claim.status !== "已轉訂單" && <button onClick={() => { void changeClaimStatus(claim, "cancel"); }} className="text-sm font-semibold text-[#A35F37]">取消</button>}</div></td></tr>) : <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[#8D877E]">尚未建立喊單。可從 LINE 截圖收件匣或右上角建立。</td></tr>}</tbody></table></div></section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white"><div className="border-b border-[#F0EDE8] px-5 py-5 sm:px-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PURCHASING SUMMARY</p><h2 className="mt-1 text-lg font-semibold">商品採購與缺貨統整</h2><p className="mt-1 text-xs text-[#8D877E]">需求量統計所有未取消喊單；填入「可供應」後會依喊單時間列出需通知的客人。未填代表尚未確認，不會誤判缺貨。</p></div><div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]"><tr><th className="px-5 py-3">商品／規格</th><th className="px-3 py-3">需採購</th><th className="px-3 py-3">已結帳</th><th className="px-3 py-3">待核對</th><th className="px-3 py-3">可供應數量</th><th className="px-3 py-3">缺貨／需通知客人</th></tr></thead><tbody className="divide-y divide-[#F0EDE8]">{procurement.length ? procurement.map((line) => <tr key={line.productId ?? `${line.productName}-${line.specification}`}><td className="px-5 py-4"><b>{line.productName}</b><small className="mt-1 block text-xs text-[#8D877E]">{[line.category, line.specification].filter(Boolean).join(" · ") || "待確認商品"}</small></td><td className="px-3 py-4 font-semibold">{line.demandQuantity}</td><td className="px-3 py-4 text-[#477154]">{line.paidQuantity}</td><td className="px-3 py-4 text-[#A66932]">{line.unresolvedQuantity || "—"}</td><td className="px-3 py-4">{line.productId ? <div className="flex items-center gap-2"><input aria-label={`${line.productName} 可供應數量`} type="number" min="0" value={supplyInputs[line.productId] ?? ""} onChange={(event) => setSupplyInputs((current) => ({ ...current, [line.productId as string]: event.target.value }))} onBlur={() => { void saveSupply(line); }} placeholder="尚未確認" className="h-9 w-24 rounded-lg border border-[#E2DED8] bg-[#FCFBF9] px-2 text-sm outline-none" /><span className="text-xs text-[#8D877E]">離開欄位即儲存</span></div> : <span className="text-xs text-[#A66932]">請先核對商品</span>}</td><td className="px-3 py-4">{line.shortageQuantity === null ? <span className="text-[#8D877E]">尚未確認</span> : line.shortageQuantity ? <div><b className="text-[#A35F37]">缺 {line.shortageQuantity}</b><p className="mt-1 max-w-xs text-xs leading-5 text-[#7E6657]">{line.affectedCustomers.map((customer) => `${customer.customerName}（${customer.quantity}）`).join("、")}</p></div> : <span className="font-semibold text-[#477154]">供應足夠</span>}</td></tr>) : <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[#8D877E]">建立喊單後，這裡會依商品規格自動統整採購數量。</td></tr>}</tbody></table></div></section>
  </>;
}

export function LiveSalePage({ catalog, openOrder, back }: { catalog: Product[]; openOrder: (id: string) => void; back: () => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: "", campaignCode: "", startDate: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }), endDate: "", note: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/live-sale/campaigns");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法讀取連線檔期。 ");
      setCampaigns((result.campaigns ?? []) as Campaign[]);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法讀取連線檔期。 "); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const createCampaign = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/live-sale/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法建立連線檔期。 ");
      setShowCreate(false);
      setSelectedCampaignId(result.campaign.id as string);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法建立連線檔期。 "); } finally { setSaving(false); }
  };

  if (selectedCampaignId) return <CampaignDetailPage campaignId={selectedCampaignId} catalog={catalog} openOrder={openOrder} back={() => { setSelectedCampaignId(""); void load(); }} onDeleted={async () => { setSelectedCampaignId(""); await load(); }} />;

  return <>
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><button onClick={back} className="text-sm font-semibold text-[#5E7665]">← 返回一般訂單</button><p className="mt-5 text-[11px] font-bold tracking-[.18em] text-[#A09A90]">LIVE SALES</p><h1 className="mt-2 text-[29px] font-semibold tracking-[-.055em]">連線檔期</h1><p className="mt-2 text-sm text-[#7B766E]">以 LINE 記事本截圖建立喊單；資料與一般訂單分開，已結帳後可手動轉入既有訂單流程。</p></div><button onClick={() => setShowCreate((current) => !current)} className={primary}>＋ 新增連線檔期</button></div>
    {error && <p role="alert" className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] px-4 py-3 text-sm font-semibold text-[#9B562A]">{error}</p>}
    {showCreate && <form onSubmit={createCampaign} className="mb-5 rounded-2xl border border-[#D9E5DB] bg-[#F6FAF6] p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#709176]">NEW CAMPAIGN</p><h2 className="mt-1 text-lg font-semibold">建立連線檔期資料夾</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-semibold text-[#58534C]">檔期名稱<input required value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="例如：10 月韓國連線" className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#58534C]">獨立檔期編號<input required value={draft.campaignCode} onChange={(event) => setDraft((current) => ({ ...current, campaignCode: event.target.value.toUpperCase() }))} placeholder="例如：KR-1026" className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#58534C]">開始日期<input required type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#58534C]">預計結單日<input type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label></div><label className="mt-4 block text-sm font-semibold text-[#58534C]">檔期備註<input value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="例如：記事本名稱、結單規則或採購提醒" className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className={outline}>取消</button><button type="submit" disabled={saving} className={primary}>{saving ? "建立中…" : "建立檔期"}</button></div></form>}
    <section className="overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white"><div className="border-b border-[#F0EDE8] px-5 py-5 sm:px-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CAMPAIGN FOLDERS</p><h2 className="mt-1 text-lg font-semibold">連線檔期列表</h2></div>{loading ? <p className="px-5 py-12 text-center text-sm text-[#8D877E]">載入連線檔期中…</p> : campaigns.length ? <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{campaigns.map((campaign) => <button key={campaign.id} onClick={() => setSelectedCampaignId(campaign.id)} className="rounded-2xl border border-[#E9E5DF] bg-[#FCFBF9] p-5 text-left transition hover:border-[#B7CEBA] hover:bg-[#F7FAF7]"><div className="flex items-start justify-between gap-3"><span><p className="text-[11px] font-bold tracking-[.16em] text-[#8F998F]">{campaign.campaign_code}</p><h3 className="mt-2 text-lg font-semibold">{campaign.name}</h3></span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${campaign.status === "進行中" ? "bg-[#E7F0E8] text-[#477154]" : campaign.status === "已結單" ? "bg-[#E5EEF2] text-[#4B6D79]" : "bg-[#F0EDE8] text-[#6F6960]"}`}>{campaign.status}</span></div><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="連線業績" value={currency(campaign.summary.activeAmount)} note="未取消喊單" accent/><Metric label="已結帳" value={currency(campaign.summary.paidAmount)} note={`${campaign.summary.claimCount} 筆喊單`} /></div><p className="mt-4 text-xs text-[#8D877E]">{dateOnly(campaign.start_date)} 起{campaign.end_date ? ` · 結單 ${dateOnly(campaign.end_date)}` : ""}</p></button>)}</div> : <p className="px-5 py-12 text-center text-sm text-[#8D877E]">尚未建立連線檔期。先新增一個檔期資料夾，才能收納記事本喊單。</p>}</section>
  </>;
}
