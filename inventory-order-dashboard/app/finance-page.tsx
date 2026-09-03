"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Customer = { id: string; name: string; line_name: string };
type Supplier = { id: string; name: string; country: string };
type EntryType = "customer_payment" | "supplier_payment" | "opening_cash";
type CurrencyCode = "TWD" | "KRW" | "JPY";
type MajorCategory = "income" | "expense" | "opening";
type Transaction = {
  id: string;
  entry_type: EntryType;
  direction: "income" | "expense";
  major_category?: string | null;
  sub_category?: string | null;
  payment_method: string;
  currency: CurrencyCode;
  region?: string | null;
  card_detail?: string | null;
  amount: number;
  occurred_on: string;
  counterparty_name: string;
  note: string;
  created_by: string;
  created_at: string;
};

const taipeiToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const currencies: CurrencyCode[] = ["TWD", "KRW", "JPY"];
const currencyLabel: Record<CurrencyCode, string> = { TWD: "台幣", KRW: "韓幣", JPY: "日幣" };
const currencySymbol: Record<CurrencyCode, string> = { TWD: "NT$", KRW: "₩", JPY: "¥" };
const regionCurrency: Record<string, CurrencyCode | null> = { "台灣": "TWD", "韓國": "KRW", "日本": "JPY", "其他": null };
const incomeSubcategories = ["員工購買", "客人購買", "其他"] as const;
const expenseSubcategories = ["供應商貨款", "貨款請款", "其他"] as const;
const cardClass = "rounded-2xl border border-[#E9E5DF] bg-white";
const inputClass = "mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#49443D] outline-none focus:border-[#89A58E]";
const emptyBalances = (): Record<CurrencyCode, number> => ({ TWD: 0, KRW: 0, JPY: 0 });
const money = (value: number, currency: CurrencyCode) => `${currencySymbol[currency]} ${value.toLocaleString("zh-TW")}`;

function BalanceRows({ balances }: { balances: Record<CurrencyCode, number> }) {
  return <div className="mt-3 space-y-1.5">{currencies.map((currency) => <div key={currency} className="flex items-center justify-between gap-3 text-xs"><span className="text-[#8B847A]">{currencyLabel[currency]}</span><b className="text-[#49443D]">{money(balances[currency], currency)}</b></div>)}</div>;
}

const transactionMajor = (transaction: Transaction) => transaction.major_category || (transaction.entry_type === "opening_cash" ? "期初現金" : transaction.direction === "income" ? "收入" : "支出");
const transactionSub = (transaction: Transaction) => transaction.sub_category || (transaction.entry_type === "customer_payment" ? "客人購買" : transaction.entry_type === "supplier_payment" ? "供應商貨款" : "期初現金");

export function FinancePage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashBalances, setCashBalances] = useState<Record<CurrencyCode, number>>(emptyBalances);
  const [majorCategory, setMajorCategory] = useState<MajorCategory>("income");
  const [subCategory, setSubCategory] = useState<string>("客人購買");
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("現金");
  const [currency, setCurrency] = useState<CurrencyCode>("TWD");
  const [region, setRegion] = useState("台灣");
  const [cardDetail, setCardDetail] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(taipeiToday());
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [financeResponse, customerResponse, supplierResponse] = await Promise.all([fetch("/api/financial-transactions"), fetch("/api/customers"), fetch("/api/suppliers")]);
      const [financeResult, customerResult, supplierResult] = await Promise.all([financeResponse.json(), customerResponse.json(), supplierResponse.json()]);
      if (!financeResponse.ok) {
        setSetupRequired(Boolean(financeResult.setupRequired));
        throw new Error(financeResult.message ?? "無法讀取收支紀錄。");
      }
      setSetupRequired(false);
      setTransactions(financeResult.transactions ?? []);
      setCashBalances({ ...emptyBalances(), ...(financeResult.cashBalances ?? {}) });
      if (customerResponse.ok) setCustomers(customerResult.customers ?? []);
      if (supplierResponse.ok) setSuppliers(supplierResult.suppliers ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法讀取收支紀錄。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    setNotice("");
    if (majorCategory === "income") { setSubCategory("客人購買"); setPaymentMethod("現金"); }
    if (majorCategory === "expense") { setSubCategory("供應商貨款"); setPaymentMethod("匯款"); }
    if (majorCategory === "opening") { setSubCategory("期初現金"); setPaymentMethod("現金"); }
  }, [majorCategory]);
  useEffect(() => {
    if (majorCategory === "expense" && paymentMethod === "信用卡" && regionCurrency[region]) setCurrency(regionCurrency[region]);
  }, [majorCategory, paymentMethod, region]);

  const thisMonth = taipeiToday().slice(0, 7);
  const totalsForDirection = (direction: "income" | "expense") => transactions.filter((transaction) => transaction.direction === direction && transaction.occurred_on.startsWith(thisMonth)).reduce<Record<CurrencyCode, number>>((totals, transaction) => ({ ...totals, [transaction.currency]: totals[transaction.currency] + transaction.amount }), emptyBalances());
  const monthIncome = useMemo(() => totalsForDirection("income"), [transactions, thisMonth]);
  const monthExpense = useMemo(() => totalsForDirection("expense"), [transactions, thisMonth]);
  const visibleTransactions = useMemo(() => filter === "all" ? transactions : transactions.filter((transaction) => transaction.direction === filter), [filter, transactions]);
  const methods = majorCategory === "income" ? ["現金", "轉帳"] : majorCategory === "expense" ? ["匯款", "現金", "信用卡"] : ["現金"];
  const isCreditCardExpense = majorCategory === "expense" && paymentMethod === "信用卡";
  const requiresCustomer = majorCategory === "income" && subCategory === "客人購買";
  const requiresSupplier = majorCategory === "expense" && subCategory === "供應商貨款";
  const counterpartLabel = majorCategory === "income" ? subCategory === "員工購買" ? "員工姓名" : "收款對象" : "支出對象";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const response = await fetch("/api/financial-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ majorCategory, subCategory, customerId, supplierId, counterpartyName, paymentMethod, currency, region: isCreditCardExpense ? region : "", cardDetail: isCreditCardExpense ? cardDetail : "", amount, occurredOn, note }),
      });
      const result = await response.json();
      if (!response.ok) {
        setSetupRequired(Boolean(result.setupRequired));
        throw new Error(result.message ?? "無法儲存收支紀錄。");
      }
      setAmount("");
      setNote("");
      setCardDetail("");
      setCounterpartyName("");
      setNotice("已儲存收支紀錄。");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法儲存收支紀錄。");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold tracking-[.18em] text-[#A09A90]">CASHFLOW</p><h1 className="mt-2 text-[29px] font-semibold tracking-[-.055em] text-[#292824] sm:text-[33px]">收支管理</h1><p className="mt-2 text-sm leading-6 text-[#7B766E]">依收入、支出與付款方式記帳；信用卡支出可依刷卡地區自動帶入幣別。</p></div><button type="button" onClick={() => { void load(); }} className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E5E1DB] bg-white px-4 text-sm font-semibold text-[#58544D] hover:bg-[#FCFBF9]">重新整理</button></div>

    {error && <section className={`${cardClass} mb-5 border-[#F0D6C2] bg-[#FFF7F0] p-4 text-sm font-semibold text-[#9B562A]`}><p>{error}</p>{setupRequired && <p className="mt-2 text-xs font-normal leading-5">請先執行本次收支資料庫更新，完成後重新整理本頁即可開始使用。</p>}</section>}
    {notice && <section className={`${cardClass} mb-5 border-[#D8E6DA] bg-[#F2F7F2] p-4 text-sm font-semibold text-[#477154]`}>{notice}</section>}

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{currencies.map((item) => <div key={item} className={`p-5 ${item === "TWD" ? "rounded-2xl border border-[#D9E4DE] bg-[#EEF4EF]" : cardClass}`}><p className={`text-xs font-semibold tracking-wide ${item === "TWD" ? "text-[#58705E]" : "text-[#807A72]"}`}>目前現金餘額 · {currencyLabel[item]}</p><p className={`mt-3 text-2xl font-semibold tracking-[-.05em] ${item === "TWD" ? "text-[#31513A]" : "text-[#292824]"}`}>{money(cashBalances[item], item)}</p><p className="mt-2 text-xs leading-5 text-[#8B847A]">只計算現金收支</p></div>)}<div className={`${cardClass} p-5`}><p className="text-xs font-semibold tracking-wide text-[#807A72]">本月收入</p><BalanceRows balances={monthIncome} /><p className="mt-2 text-xs text-[#8B847A]">現金與轉帳合計</p></div><div className={`${cardClass} p-5`}><p className="text-xs font-semibold tracking-wide text-[#807A72]">本月支出</p><BalanceRows balances={monthExpense} /><p className="mt-2 text-xs text-[#8B847A]">匯款、現金與信用卡合計</p></div></section>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.65fr)]">
      <section className={`${cardClass} overflow-hidden`}><div className="flex flex-col gap-4 border-b border-[#F0EDE8] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">TRANSACTION HISTORY</p><h2 className="mt-2 text-xl font-semibold">收支紀錄</h2></div><div className="flex gap-2 overflow-x-auto">{([ ["all", "全部"], ["income", "收入"], ["expense", "支出"] ] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${filter === id ? "bg-[#292824] text-white" : "bg-[#F4F1ED] text-[#706A61]"}`}>{label}</button>)}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[930px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">日期</th><th className="px-3 py-3">大分類</th><th className="px-3 py-3">小分類</th><th className="px-3 py-3">對象</th><th className="px-3 py-3">方式</th><th className="px-3 py-3">信用卡明細</th><th className="px-3 py-3">備註</th><th className="px-6 py-3 text-right">金額</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{loading ? <tr><td colSpan={8} className="px-6 py-10 text-center text-[#8D877E]">載入收支紀錄中…</td></tr> : visibleTransactions.length ? visibleTransactions.map((transaction) => <tr key={transaction.id} className="hover:bg-[#FCFBF9]"><td className="px-6 py-4 text-[#6F6960]">{transaction.occurred_on.replaceAll("-", "/")}</td><td className="px-3 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${transaction.direction === "income" ? "bg-[#E7F0E8] text-[#477154]" : "bg-[#FAECDD] text-[#A66932]"}`}>{transactionMajor(transaction)}</span></td><td className="px-3 py-4 font-semibold text-[#4A4640]">{transactionSub(transaction)}</td><td className="px-3 py-4 text-[#5C574F]">{transaction.counterparty_name}</td><td className="px-3 py-4 text-[#6F6960]">{transaction.payment_method}</td><td className="max-w-[170px] px-3 py-4 text-xs text-[#817B72]">{transaction.payment_method === "信用卡" ? [transaction.region, transaction.card_detail].filter(Boolean).join(" · ") || "—" : "—"}</td><td className="max-w-[150px] truncate px-3 py-4 text-[#817B72]">{transaction.note || "—"}</td><td className={`px-6 py-4 text-right font-semibold ${transaction.direction === "income" ? "text-[#477154]" : "text-[#A66932]"}`}>{transaction.direction === "income" ? "+" : "−"}{money(transaction.amount, transaction.currency)}</td></tr>) : <tr><td colSpan={8} className="px-6 py-12 text-center text-[#8D877E]">尚無收支紀錄。請從右側新增第一筆記帳。</td></tr>}</tbody></table></div></section>

      <section className={`${cardClass} h-fit p-5 sm:p-6`}><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">NEW ENTRY</p><h2 className="mt-2 text-xl font-semibold">新增收支紀錄</h2><p className="mt-2 text-sm leading-6 text-[#898379]">先選擇大分類與小分類，再填寫對象、付款方式與金額。</p><form className="mt-5 space-y-4" onSubmit={(event) => { void submit(event); }}><div className="grid grid-cols-3 gap-2">{([ ["income", "收入"], ["expense", "支出"], ["opening", "期初現金"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setMajorCategory(value)} className={`min-h-12 rounded-xl border px-2 text-xs font-semibold ${majorCategory === value ? "border-[#87A18D] bg-[#EDF5EE] text-[#426349]" : "border-[#E5E1DB] bg-white text-[#777168] hover:bg-[#FCFBF9]"}`}>{label}</button>)}</div>
        {majorCategory !== "opening" && <label className="block text-sm font-semibold text-[#58534C]">小分類<div className="mt-2 grid grid-cols-3 gap-2">{(majorCategory === "income" ? incomeSubcategories : expenseSubcategories).map((item) => <button key={item} type="button" onClick={() => setSubCategory(item)} className={`min-h-10 rounded-xl border px-2 text-xs font-semibold ${subCategory === item ? "border-[#9EBAA4] bg-[#F2F7F2] text-[#426349]" : "border-[#E5E1DB] bg-white text-[#777168]"}`}>{item}</button>)}</div></label>}
        {requiresCustomer && <label className="block text-sm font-semibold text-[#58534C]">客戶<select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className={inputClass} required><option value="">選擇客戶</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.line_name ? ` · ${customer.line_name}` : ""}</option>)}</select>{!customers.length && !loading && <small className="mt-2 block text-xs font-normal text-[#A66932]">尚未建立客戶，請先到客戶管理新增資料。</small>}</label>}
        {requiresSupplier && <label className="block text-sm font-semibold text-[#58534C]">供應商<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={inputClass} required><option value="">選擇供應商</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.country ? ` · ${supplier.country}` : ""}</option>)}</select>{!suppliers.length && !loading && <small className="mt-2 block text-xs font-normal text-[#A66932]">尚未建立供應商，請先到採購與供應商新增資料。</small>}</label>}
        {majorCategory !== "opening" && !requiresCustomer && !requiresSupplier && <label className="block text-sm font-semibold text-[#58534C]">{counterpartLabel}<input value={counterpartyName} onChange={(event) => setCounterpartyName(event.target.value)} placeholder={majorCategory === "income" ? "例如：王小明" : "例如：物流費用"} className={inputClass} required /></label>}
        {majorCategory === "opening" && <div className="rounded-xl bg-[#F8F6F2] px-4 py-3 text-xs leading-5 text-[#776F65]">第一次開始記帳時，輸入手上既有的現金。之後的現金收款與現金支出會自動加減餘額。</div>}
        <div className="grid gap-4 sm:grid-cols-3"><label className="block text-sm font-semibold text-[#58534C]">收支日期<input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} className={inputClass} required /></label><label className="block text-sm font-semibold text-[#58534C]">付款方式<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={inputClass}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label><label className="block text-sm font-semibold text-[#58534C]">幣別<select value={currency} disabled={isCreditCardExpense && Boolean(regionCurrency[region])} onChange={(event) => setCurrency(event.target.value as CurrencyCode)} className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}>{currencies.map((item) => <option key={item} value={item}>{currencyLabel[item]}（{currencySymbol[item]}）</option>)}</select></label></div>
        {isCreditCardExpense && <div className="rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] p-4"><p className="text-sm font-semibold text-[#58534C]">信用卡支出明細</p><p className="mt-1 text-xs leading-5 text-[#8B847A]">選擇刷卡地區後會自動帶入幣別；選其他地區可自行選擇幣別。</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-[#58534C]">刷卡地區<select value={region} onChange={(event) => setRegion(event.target.value)} className={inputClass}>{Object.keys(regionCurrency).map((item) => <option key={item}>{item}</option>)}</select></label><label className="block text-sm font-semibold text-[#58534C]">明細／商家<input value={cardDetail} onChange={(event) => setCardDetail(event.target.value)} placeholder="例如：Olive Young 弘大店" className={inputClass} required /></label></div></div>}
        <label className="block text-sm font-semibold text-[#58534C]">金額<input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="輸入金額" className={inputClass} required /></label><label className="block text-sm font-semibold text-[#58534C]">備註<span className="ml-1 text-xs font-normal text-[#9B958C]">（選填）</span><textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 py-3 text-sm font-normal text-[#49443D] outline-none focus:border-[#89A58E]" placeholder="例如：8 月貨款、客戶訂單尾款" /></label><button type="submit" disabled={saving || setupRequired} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white transition hover:bg-[#46423D] disabled:cursor-not-allowed disabled:opacity-45">{saving ? "儲存中…" : "儲存收支紀錄"}</button></form></section>
    </div>
  </>;
}
