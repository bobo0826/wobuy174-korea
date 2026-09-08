"use client";

import { useEffect, useState } from "react";

type PurchaseOrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  unit_cost: number;
  local_unit_cost: number;
  quantity: number;
  received_quantity: number;
};

export type PurchaseOrder = {
  id: string;
  purchase_number: string;
  supplier_id: string | null;
  supplier_name: string;
  order_date: string | null;
  arrival_date: string | null;
  expected_arrival_date?: string | null;
  payment_terms: string;
  currency_code: string;
  shipping_fee: number;
  status: "草稿" | "已送出" | "部分收貨" | "待收貨" | "已完成" | "已取消";
  total: number;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  purchase_order_items: PurchaseOrderItem[];
};

type View = "purchases" | "newPurchase" | "suppliers";

const twd = (value: number) => `NT$ ${Number(value || 0).toLocaleString("zh-TW")}`;
const localMoney = (value: number, code: string) => new Intl.NumberFormat("zh-TW", { style: "currency", currency: code || "TWD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0));
const formatDate = (value: string | null | undefined) => value ? value.replaceAll("-", "/") : "未設定";
const sortByOrderDate = (items: PurchaseOrder[]) => [...items].sort((left, right) => {
  const dateOrder = (right.order_date ?? "").localeCompare(left.order_date ?? "");
  return dateOrder || right.created_at.localeCompare(left.created_at);
});
const statusStyle: Record<PurchaseOrder["status"], string> = {
  "草稿": "bg-[#F0EDE8] text-[#6F6960]",
  "已送出": "bg-[#E5EEF2] text-[#4B6D79]",
  "待收貨": "bg-[#E5EEF2] text-[#4B6D79]",
  "部分收貨": "bg-[#FAECDD] text-[#A66932]",
  "已完成": "bg-[#E7F0E8] text-[#477154]",
  "已取消": "bg-[#F0EDE8] text-[#6F6960]",
};

function canEdit(purchase: PurchaseOrder) {
  return !["已完成", "已取消"].includes(purchase.status) && !purchase.purchase_order_items.some((item) => item.received_quantity > 0);
}

function canReceive(purchase: PurchaseOrder) {
  return !["已完成", "已取消"].includes(purchase.status) && purchase.purchase_order_items.some((item) => item.received_quantity < item.quantity);
}

function canRevertReceipt(purchase: PurchaseOrder) {
  return purchase.status !== "已取消" && purchase.purchase_order_items.some((item) => item.received_quantity > 0);
}

export function PurchasesPageV2({ go, onInventoryChanged, onEdit }: { go: (view: View) => void; onInventoryChanged: () => Promise<void>; onEdit: (purchase: PurchaseOrder) => void }) {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [receipt, setReceipt] = useState<PurchaseOrder | null>(null);
  const [reverting, setReverting] = useState<PurchaseOrder | null>(null);
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/purchase-orders");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法讀取採購單。");
      // 也在畫面端固定排序，確保重新整理或資料更新後仍以最新下單時間為首。
      setPurchases(sortByOrderDate(result.purchaseOrders ?? []));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法讀取採購單。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openReceipt = (purchase: PurchaseOrder) => {
    setSelected(null);
    setReceipt(purchase);
    setReceiptQuantities(Object.fromEntries(purchase.purchase_order_items.map((item) => [item.id, String(Math.max(0, item.quantity - item.received_quantity))])));
    setError("");
  };

  const receive = async () => {
    if (!receipt) return;
    const items = receipt.purchase_order_items
      .map((item) => ({ itemId: item.id, quantity: Number(receiptQuantities[item.id]) || 0 }))
      .filter((item) => item.quantity > 0);
    if (!items.length) {
      setError("請至少填寫一項本次到貨數量。");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/purchase-orders/${receipt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "receive", items }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法確認到貨。");
      setPurchases((previous) => sortByOrderDate(previous.map((purchase) => purchase.id === receipt.id ? result.purchaseOrder : purchase)));
      setReceipt(null);
      await onInventoryChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法確認到貨。");
    } finally {
      setSaving(false);
    }
  };

  const revertReceipt = async () => {
    if (!reverting) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/purchase-orders/${reverting.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revertReceipt" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法回復收貨。");
      setPurchases((previous) => sortByOrderDate(previous.map((purchase) => purchase.id === reverting.id ? result.purchaseOrder : purchase)));
      setSelected((previous) => previous?.id === reverting.id ? result.purchaseOrder : previous);
      setReverting(null);
      await onInventoryChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法回復收貨。");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-bold tracking-[.18em] text-[#A09A90]">PURCHASING</p>
        <h1 className="mt-2 text-[29px] font-semibold tracking-[-.055em]">採購與供應商</h1>
        <p className="mt-2 text-sm text-[#7B766E]">查看採購明細、修改尚未收貨的採購單，並在確認到貨後入庫。</p>
      </div>
      <button onClick={() => go("newPurchase")} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white">＋ 建立採購單</button>
    </header>

    {error && !receipt && <p role="alert" className="mb-5 rounded-xl border border-[#F0D6C2] bg-[#FFF7F0] p-4 text-sm font-semibold text-[#9B562A]">{error}</p>}

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EDE8] p-5 sm:p-6">
          <div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PURCHASE ORDERS</p><h2 className="mt-2 text-xl font-semibold">採購單與到貨入庫</h2><p className="mt-1 text-xs text-[#938D84]">依下單時間排序（最新在前）</p></div>
          <button onClick={() => { void load(); }} className="text-sm font-semibold text-[#5E7665]">重新整理</button>
        </div>
        <div className="divide-y divide-[#F0EDE8]">
          {loading ? <p className="p-7 text-center text-sm text-[#8D877E]">載入採購單中…</p> : purchases.length ? purchases.map((purchase) => <article key={purchase.id} className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <button onClick={() => setSelected(purchase)} className="min-w-0 text-left">
                <div className="flex flex-wrap items-center gap-2"><b className="text-base text-[#403C36]">{purchase.purchase_number}</b><span className={`inline-flex min-h-6 items-center justify-center rounded-full px-2.5 py-1 text-center text-[11px] font-semibold leading-none ${statusStyle[purchase.status]}`}>{purchase.status}</span></div>
                <p className="mt-2 text-sm font-semibold text-[#5A554D]">{purchase.supplier_name}</p>
                <p className="mt-1 text-xs text-[#938D84]">下單 {formatDate(purchase.order_date)}　·　到貨 {formatDate(purchase.arrival_date ?? purchase.expected_arrival_date)}　·　{purchase.payment_terms || "未設定交易方式"}</p>
              </button>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end"><span className="mr-1 text-sm font-semibold">{twd(purchase.total)}</span><button onClick={() => setSelected(purchase)} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665]">查看採購單</button>{canEdit(purchase) && <button onClick={() => onEdit(purchase)} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665]">修改內容</button>}{canReceive(purchase) && <button onClick={() => openReceipt(purchase)} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#5D7B64] px-3 text-sm font-semibold text-white">確認到貨並入庫</button>}{canRevertReceipt(purchase) && <button onClick={() => { setReverting(purchase); setError(""); }} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#E4C7B2] bg-white px-3 text-sm font-semibold text-[#A35F37]">回復未收貨</button>}</div>
            </div>
            <p className="mt-4 rounded-xl bg-[#F8F6F2] px-4 py-3 text-xs text-[#706A61]">{purchase.purchase_order_items.map((item) => `${item.product_name}｜已到貨 ${item.received_quantity}/${item.quantity}`).join("　")}</p>
          </article>) : <p className="p-8 text-center text-sm text-[#8D877E]">尚無採購單。請先建立第一張採購單。</p>}
        </div>
      </section>
      <aside className="h-fit rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">SUPPLIERS</p><h2 className="mt-2 text-xl font-semibold">供應商管理</h2><p className="mt-2 text-sm leading-6 text-[#898379]">先建立供應商，再選擇商品貨號建立採購單。</p><button onClick={() => go("suppliers")} className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-4 text-sm font-semibold text-[#5E7665]">管理供應商</button></aside>
    </div>

    {selected && <div className="fixed inset-0 z-50 flex items-end bg-[#292824]/35 sm:items-center sm:justify-center sm:p-6">
      <div role="dialog" aria-modal="true" aria-label="查看採購單" className="max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PURCHASE ORDER</p><h2 className="mt-2 text-xl font-semibold">採購單 {selected.purchase_number}</h2><p className="mt-2 text-sm text-[#7D776E]">{selected.supplier_name} · {selected.status}</p></div><button aria-label="關閉採購單" onClick={() => setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg">×</button></div>
        <div className="mt-6 grid gap-4 rounded-2xl bg-[#F8F6F2] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-[#938D84]">下單時間</p><b className="mt-1 block">{formatDate(selected.order_date)}</b></div><div><p className="text-xs text-[#938D84]">到貨時間</p><b className="mt-1 block">{formatDate(selected.arrival_date ?? selected.expected_arrival_date)}</b></div><div><p className="text-xs text-[#938D84]">當地幣別</p><b className="mt-1 block">{selected.currency_code || "TWD"}</b></div><div><p className="text-xs text-[#938D84]">交易方式／付款條件</p><b className="mt-1 block">{selected.payment_terms || "—"}</b></div></div>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[#E9E5DF]"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]"><tr><th className="px-5 py-3">商品</th><th className="px-3 py-3">台幣成本</th><th className="px-3 py-3">當地成本</th><th className="px-3 py-3">訂購</th><th className="px-3 py-3">已到貨</th><th className="px-5 py-3 text-right">尚待到貨</th></tr></thead><tbody className="divide-y divide-[#F0EDE8]">{selected.purchase_order_items.map((item) => <tr key={item.id}><td className="px-5 py-4 font-semibold">{item.product_name}</td><td className="px-3 py-4">{twd(item.unit_cost)}</td><td className="px-3 py-4">{localMoney(item.local_unit_cost, selected.currency_code)}</td><td className="px-3 py-4">{item.quantity}</td><td className="px-3 py-4">{item.received_quantity}</td><td className="px-5 py-4 text-right font-semibold">{Math.max(0, item.quantity - item.received_quantity)}</td></tr>)}</tbody></table></div>
        <div className="mt-5 grid gap-3 rounded-2xl border border-[#E9E5DF] p-4 text-sm sm:grid-cols-3"><div><span className="text-[#807A72]">台幣商品成本</span><b className="mt-1 block">{twd(selected.total)}</b></div><div><span className="text-[#807A72]">當地運費</span><b className="mt-1 block">{localMoney(selected.shipping_fee, selected.currency_code)}</b></div><div><span className="text-[#807A72]">訂購總數</span><b className="mt-1 block">{selected.purchase_order_items.reduce((sum, item) => sum + item.quantity, 0)} 件</b></div></div>
        {!canEdit(selected) && selected.status !== "已完成" && selected.status !== "已取消" && <p className="mt-4 text-sm text-[#807A72]">這張採購單已有到貨紀錄，為維持庫存正確性，商品明細不可再修改。</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={() => setSelected(null)} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665]">關閉</button>{canEdit(selected) && <button onClick={() => { onEdit(selected); setSelected(null); }} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665]">修改內容</button>}{canReceive(selected) && <button onClick={() => openReceipt(selected)} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#5D7B64] px-4 text-sm font-semibold text-white">確認到貨並入庫</button>}{canRevertReceipt(selected) && <button onClick={() => { setReverting(selected); setError(""); }} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#E4C7B2] bg-white px-3 text-sm font-semibold text-[#A35F37]">回復未收貨</button>}</div>
      </div>
    </div>}

    {receipt && <div className="fixed inset-0 z-50 flex items-end bg-[#292824]/35 sm:items-center sm:justify-center sm:p-6"><div role="dialog" aria-modal="true" aria-label="確認到貨並入庫" className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">RECEIVE PURCHASE ORDER</p><h2 className="mt-2 text-xl font-semibold">確認到貨並入庫</h2><p className="mt-2 text-sm leading-6 text-[#7D776E]">數量已預先帶入尚待到貨數量；確認後才會增加商品可售庫存。</p></div><button aria-label="關閉收貨視窗" onClick={() => setReceipt(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg">×</button></div><div className="mt-6 divide-y divide-[#F0EDE8] rounded-xl border border-[#ECE8E2]">{receipt.purchase_order_items.map((item) => { const remaining = item.quantity - item.received_quantity; return <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_120px]"><div><b className="block text-sm">{item.product_name}</b><p className="mt-1 text-xs text-[#8D877E]">訂購 {item.quantity} · 已到貨 {item.received_quantity} · 尚待到貨 {remaining}</p></div><label className="text-xs font-semibold text-[#7C766D]">本次到貨<input type="number" min="0" max={remaining} value={receiptQuantities[item.id] ?? "0"} onChange={(event) => setReceiptQuantities((previous) => ({ ...previous, [item.id]: event.target.value }))} disabled={remaining === 0} className="mt-1 h-10 w-full rounded-lg border border-[#E5E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none disabled:opacity-40" /></label></div>; })}</div>{error && <p role="alert" className="mt-4 text-sm font-semibold text-[#A35F37]">{error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={() => setReceipt(null)} disabled={saving} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665]">取消</button><button onClick={() => { void receive(); }} disabled={saving} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#5D7B64] px-4 text-sm font-semibold text-white disabled:opacity-45">{saving ? "入庫中…" : "確認到貨並入庫"}</button></div></div></div>}
    {reverting && <div className="fixed inset-0 z-[60] flex items-end bg-[#292824]/35 sm:items-center sm:justify-center sm:p-6"><div role="dialog" aria-modal="true" aria-label="回復至尚未收貨" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">REVERT RECEIPT</p><h2 className="mt-2 text-xl font-semibold">回復至尚未收貨</h2><p className="mt-2 text-sm leading-6 text-[#7D776E]">已入庫數量會回到「到貨中」，並從可售庫存扣除。</p></div><button aria-label="關閉回復收貨視窗" onClick={() => setReverting(null)} disabled={saving} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg">×</button></div><div className="mt-5 rounded-xl bg-[#F8F6F2] p-4 text-sm text-[#625C53]"><b className="block">{reverting.purchase_number}</b><p className="mt-2">{reverting.purchase_order_items.filter((item) => item.received_quantity > 0).map((item) => `${item.product_name} × ${item.received_quantity}`).join("、")}</p></div><p className="mt-4 text-sm leading-6 text-[#8A613F]">若商品已被後續出貨或扣庫存，系統會保護庫存並禁止回復。</p>{error && <p role="alert" className="mt-4 text-sm font-semibold text-[#A35F37]">{error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={() => setReverting(null)} disabled={saving} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665]">取消</button><button onClick={() => { void revertReceipt(); }} disabled={saving} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#A35F37] px-4 text-sm font-semibold text-white disabled:opacity-45">{saving ? "回復中…" : "確認回復"}</button></div></div></div>}
  </>;
}
