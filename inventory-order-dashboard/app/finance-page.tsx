"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Customer = { id: string; name: string; line_name: string };
type Supplier = { id: string; name: string; country: string };
type OrderOption = { id: string; order_number: string; order_date: string; status: string; reconciliation_status: string; customers: Customer | null };
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
  supplier_id?: string | null;
  order_id?: string | null;
  settled_twd_amount?: number | null;
  credit_card_claimed?: boolean;
  credit_card_claimed_at?: string | null;
  credit_card_claimed_by?: string | null;
  credit_card_claim_batch_id?: string | null;
  credit_card_claim_batches?: { total_twd_amount: number; entry_count: number; claimed_at: string } | null;
  note: string;
  created_by: string;
  created_at: string;
};
type CreditCardDraft = {
  id: string;
  subCategory: string;
  supplierId: string;
  counterpartyName: string;
  currency: CurrencyCode;
  region: string;
  cardDetail: string;
  amount: string;
  occurredOn: string;
  note: string;
  settledTwdAmount: string;
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
const incomeSubcategories = ["訂單結帳", "零售購買", "其他"] as const;
const expenseSubcategories = ["供應商貨款", "貨款請款", "其他"] as const;
const cardClass = "rounded-2xl border border-[#E9E5DF] bg-white";
const inputClass = "mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#49443D] outline-none focus:border-[#89A58E]";
const emptyBalances = (): Record<CurrencyCode, number> => ({ TWD: 0, KRW: 0, JPY: 0 });
const money = (value: number, currency: CurrencyCode) => `${currencySymbol[currency]} ${value.toLocaleString("zh-TW")}`;

function BalanceRows({ balances }: { balances: Record<CurrencyCode, number> }) {
  return <div className="mt-3 space-y-1.5">{currencies.map((currency) => <div key={currency} className="flex items-center justify-between gap-3 text-xs"><span className="text-[#8B847A]">{currencyLabel[currency]}</span><b className="text-[#49443D]">{money(balances[currency], currency)}</b></div>)}</div>;
}

const transactionMajor = (transaction: Transaction) => transaction.major_category || (transaction.entry_type === "opening_cash" ? "期初現金" : transaction.direction === "income" ? "收入" : "支出");
const transactionSub = (transaction: Transaction) => transaction.sub_category || (transaction.entry_type === "customer_payment" ? "訂單結帳" : transaction.entry_type === "supplier_payment" ? "供應商貨款" : "期初現金");
const isCreditCardAdvance = (transaction: Transaction) => transaction.direction === "expense" && transaction.payment_method === "信用卡";
const isClaimed = (transaction: Transaction) => Boolean(transaction.credit_card_claimed);

export function FinancePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashBalances, setCashBalances] = useState<Record<CurrencyCode, number>>(emptyBalances);
  const [majorCategory, setMajorCategory] = useState<MajorCategory>("income");
  const [subCategory, setSubCategory] = useState<string>("訂單結帳");
  const [orderId, setOrderId] = useState("");
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
  const [keyword, setKeyword] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [subCategoryFilter, setSubCategoryFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [creditCardDraft, setCreditCardDraft] = useState<CreditCardDraft | null>(null);
  const [creditSaving, setCreditSaving] = useState(false);
  const [selectedCreditCardIds, setSelectedCreditCardIds] = useState<string[]>([]);
  const [claimBatchOpen, setClaimBatchOpen] = useState(false);
  const [claimBatchTotal, setClaimBatchTotal] = useState("");
  const [claimBatchSaving, setClaimBatchSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [financeResponse, supplierResponse, orderResponse] = await Promise.all([fetch("/api/financial-transactions"), fetch("/api/suppliers"), fetch("/api/orders")]);
      const [financeResult, supplierResult, orderResult] = await Promise.all([financeResponse.json(), supplierResponse.json(), orderResponse.json()]);
      if (!financeResponse.ok) {
        setSetupRequired(Boolean(financeResult.setupRequired));
        throw new Error(financeResult.message ?? "無法讀取收支紀錄。");
      }
      setSetupRequired(false);
      setTransactions(financeResult.transactions ?? []);
      setCashBalances({ ...emptyBalances(), ...(financeResult.cashBalances ?? {}) });
      if (supplierResponse.ok) setSuppliers(supplierResult.suppliers ?? []);
      if (orderResponse.ok) setOrders(orderResult.orders ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法讀取收支紀錄。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    setNotice("");
    setOrderId("");
    if (majorCategory === "income") { setSubCategory("訂單結帳"); setPaymentMethod("現金"); }
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
  const transactionSubcategories = useMemo(() => [...new Set(transactions.map(transactionSub))].sort((left, right) => left.localeCompare(right, "zh-TW")), [transactions]);
  const transactionMethods = useMemo(() => [...new Set(transactions.map((transaction) => transaction.payment_method))].sort((left, right) => left.localeCompare(right, "zh-TW")), [transactions]);
  const visibleTransactions = useMemo(() => transactions.filter((transaction) => {
    const matchesDirection = filter === "all" || transaction.direction === filter;
    const matchesKeyword = !keyword.trim() || [transaction.counterparty_name, transactionSub(transaction), transaction.note, transaction.region, transaction.card_detail, transaction.created_by, transaction.credit_card_claimed_by].filter(Boolean).join(" ").toLowerCase().includes(keyword.trim().toLowerCase());
    const matchesStart = !startDate || transaction.occurred_on >= startDate;
    const matchesEnd = !endDate || transaction.occurred_on <= endDate;
    const matchesSubcategory = subCategoryFilter === "all" || transactionSub(transaction) === subCategoryFilter;
    const matchesMethod = paymentMethodFilter === "all" || transaction.payment_method === paymentMethodFilter;
    return matchesDirection && matchesKeyword && matchesStart && matchesEnd && matchesSubcategory && matchesMethod;
  }), [endDate, filter, keyword, paymentMethodFilter, startDate, subCategoryFilter, transactions]);
  const selectedCreditCardTransactions = useMemo(() => transactions.filter((transaction) => selectedCreditCardIds.includes(transaction.id) && isCreditCardAdvance(transaction) && !isClaimed(transaction)), [selectedCreditCardIds, transactions]);
  const selectedKnownTwdTotal = useMemo(() => selectedCreditCardTransactions.reduce((sum, transaction) => transaction.currency === "TWD" ? sum + transaction.amount : sum, 0), [selectedCreditCardTransactions]);
  const selectedForeignCount = useMemo(() => selectedCreditCardTransactions.filter((transaction) => transaction.currency !== "TWD").length, [selectedCreditCardTransactions]);
  const methods = majorCategory === "income" ? ["現金", "轉帳"] : majorCategory === "expense" ? ["匯款", "現金", "信用卡"] : ["現金"];
  const isCreditCardExpense = majorCategory === "expense" && paymentMethod === "信用卡";
  const requiresOrder = majorCategory === "income" && subCategory === "訂單結帳";
  const requiresSupplier = majorCategory === "expense" && subCategory === "供應商貨款";
  const counterpartLabel = majorCategory === "income" ? subCategory === "零售購買" ? "購買對象" : "收款對象" : "支出對象";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const response = await fetch("/api/financial-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ majorCategory, subCategory, orderId, supplierId, counterpartyName, paymentMethod, currency, region: isCreditCardExpense ? region : "", cardDetail: isCreditCardExpense ? cardDetail : "", amount, occurredOn, note }),
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

  const deleteTransaction = async (transaction: Transaction) => {
    const cashMessage = transaction.payment_method === "現金" ? "現金餘額也會自動回復。" : "本月收支統計會自動重新計算。";
    if (!window.confirm(`確定要刪除這筆「${transactionSub(transaction)}」紀錄嗎？此動作無法復原。${cashMessage}`)) return;
    setDeletingId(transaction.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/financial-transactions?id=${encodeURIComponent(transaction.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        setSetupRequired(Boolean(result.setupRequired));
        throw new Error(result.message ?? "無法刪除收支紀錄。");
      }
      if (selectedTransaction?.id === transaction.id) setSelectedTransaction(null);
      await load();
      setNotice(`已刪除「${transactionSub(transaction)}」紀錄；${cashMessage}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法刪除收支紀錄。");
    } finally {
      setDeletingId("");
    }
  };

  const openCreditCardEditor = (transaction: Transaction) => {
    if (!isCreditCardAdvance(transaction) || isClaimed(transaction)) return;
    setError("");
    setNotice("");
    setCreditCardDraft({
      id: transaction.id,
      subCategory: transactionSub(transaction),
      supplierId: transaction.supplier_id ?? "",
      counterpartyName: transaction.counterparty_name,
      currency: transaction.currency,
      region: transaction.region || "其他",
      cardDetail: transaction.card_detail || "",
      amount: String(transaction.amount),
      occurredOn: transaction.occurred_on,
      note: transaction.note || "",
      settledTwdAmount: transaction.settled_twd_amount ? String(transaction.settled_twd_amount) : "",
    });
  };

  const saveCreditCardAdvance = async (claim: boolean) => {
    if (!creditCardDraft) return;
    setCreditSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/financial-transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: claim ? "claimCreditCard" : "updateCreditCard", id: creditCardDraft.id, majorCategory: "expense", subCategory: creditCardDraft.subCategory, supplierId: creditCardDraft.supplierId, counterpartyName: creditCardDraft.counterpartyName, paymentMethod: "信用卡", currency: creditCardDraft.currency, region: creditCardDraft.region, cardDetail: creditCardDraft.cardDetail, amount: creditCardDraft.amount, occurredOn: creditCardDraft.occurredOn, note: creditCardDraft.note, settledTwdAmount: creditCardDraft.currency === "TWD" ? creditCardDraft.amount : creditCardDraft.settledTwdAmount }),
      });
      const result = await response.json();
      if (!response.ok) {
        setSetupRequired(Boolean(result.setupRequired));
        throw new Error(result.message ?? "無法更新信用卡代墊款。");
      }
      setTransactions((previous) => previous.map((transaction) => transaction.id === result.transaction.id ? result.transaction : transaction));
      setSelectedTransaction((previous) => previous?.id === result.transaction.id ? result.transaction : previous);
      setCreditCardDraft(null);
      setNotice(claim ? "已確認請款；這筆信用卡代墊款已鎖定，無法再修改。" : "信用卡代墊款已更新。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法更新信用卡代墊款。");
    } finally {
      setCreditSaving(false);
    }
  };

  const updateCreditCardDraft = (change: Partial<CreditCardDraft>) => setCreditCardDraft((previous) => previous ? { ...previous, ...change } : previous);

  const toggleCreditCardSelection = (transaction: Transaction) => {
    if (!isCreditCardAdvance(transaction) || isClaimed(transaction)) return;
    setSelectedCreditCardIds((current) => current.includes(transaction.id) ? current.filter((id) => id !== transaction.id) : [...current, transaction.id]);
  };

  const openClaimBatch = () => {
    if (!selectedCreditCardTransactions.length) return;
    setClaimBatchTotal(selectedKnownTwdTotal ? String(selectedKnownTwdTotal) : "");
    setClaimBatchOpen(true);
    setError("");
    setNotice("");
  };

  const claimCreditCardBatch = async () => {
    if (!selectedCreditCardTransactions.length) return;
    setClaimBatchSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/financial-transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claimCreditCardBatch", ids: selectedCreditCardTransactions.map((transaction) => transaction.id), totalTwdAmount: claimBatchTotal }),
      });
      const result = await response.json();
      if (!response.ok) {
        setSetupRequired(Boolean(result.setupRequired));
        throw new Error(result.message ?? "無法合併請款信用卡代墊款。");
      }
      setSelectedCreditCardIds([]);
      setClaimBatchOpen(false);
      await load();
      setNotice(`已將 ${selectedCreditCardTransactions.length} 筆信用卡代墊款以 ${money(Number(result.batch?.total_twd_amount) || 0, "TWD")} 合併請款並鎖定。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法合併請款信用卡代墊款。");
    } finally {
      setClaimBatchSaving(false);
    }
  };

  return <>
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold tracking-[.18em] text-[#A09A90]">CASHFLOW</p><h1 className="mt-2 text-[29px] font-semibold tracking-[-.055em] text-[#292824] sm:text-[33px]">收支管理</h1><p className="mt-2 text-sm leading-6 text-[#7B766E]">依收入、支出與付款方式記帳；信用卡支出會列為代墊款，可在結帳後補登台幣金額並確認請款。</p></div><button type="button" onClick={() => { void load(); }} className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E5E1DB] bg-white px-4 text-sm font-semibold text-[#58544D] hover:bg-[#FCFBF9]">重新整理</button></div>

    {error && <section className={`${cardClass} mb-5 border-[#F0D6C2] bg-[#FFF7F0] p-4 text-sm font-semibold text-[#9B562A]`}><p>{error}</p>{setupRequired && <p className="mt-2 text-xs font-normal leading-5">請先執行本次收支資料庫更新，完成後重新整理本頁即可開始使用。</p>}</section>}
    {notice && <section className={`${cardClass} mb-5 border-[#D8E6DA] bg-[#F2F7F2] p-4 text-sm font-semibold text-[#477154]`}>{notice}</section>}

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{currencies.map((item) => <div key={item} className={`p-5 ${item === "TWD" ? "rounded-2xl border border-[#D9E4DE] bg-[#EEF4EF]" : cardClass}`}><p className={`text-xs font-semibold tracking-wide ${item === "TWD" ? "text-[#58705E]" : "text-[#807A72]"}`}>目前現金餘額 · {currencyLabel[item]}</p><p className={`mt-3 text-2xl font-semibold tracking-[-.05em] ${item === "TWD" ? "text-[#31513A]" : "text-[#292824]"}`}>{money(cashBalances[item], item)}</p><p className="mt-2 text-xs leading-5 text-[#8B847A]">只計算現金收支</p></div>)}<div className={`${cardClass} p-5`}><p className="text-xs font-semibold tracking-wide text-[#807A72]">本月收入</p><BalanceRows balances={monthIncome} /><p className="mt-2 text-xs text-[#8B847A]">現金與轉帳合計</p></div><div className={`${cardClass} p-5`}><p className="text-xs font-semibold tracking-wide text-[#807A72]">本月支出</p><BalanceRows balances={monthExpense} /><p className="mt-2 text-xs text-[#8B847A]">匯款、現金與信用卡合計</p></div></section>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.65fr)]">
      <section className={`${cardClass} overflow-hidden`}>
        <div className="flex flex-col gap-4 border-b border-[#F0EDE8] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">TRANSACTION HISTORY</p><h2 className="mt-2 text-xl font-semibold">收支紀錄</h2></div>
          <div className="flex gap-2 overflow-x-auto">{([ ["all", "全部"], ["income", "收入"], ["expense", "支出"] ] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${filter === id ? "bg-[#292824] text-white" : "bg-[#F4F1ED] text-[#706A61]"}`}>{label}</button>)}</div>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-b border-[#F0EDE8] bg-[#FCFBF9] p-4 sm:px-6">
          <label className="min-w-[180px] flex-1 text-xs font-semibold text-[#777168]">搜尋<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜尋對象、分類、紀錄者、備註或信用卡明細" className="mt-1 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label>
          <label className="text-xs font-semibold text-[#777168]">起日<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 h-10 rounded-lg border border-[#E6E1DB] bg-white px-2 text-sm font-normal outline-none" /></label>
          <label className="text-xs font-semibold text-[#777168]">迄日<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 h-10 rounded-lg border border-[#E6E1DB] bg-white px-2 text-sm font-normal outline-none" /></label>
          <label className="text-xs font-semibold text-[#777168]">小分類<select value={subCategoryFilter} onChange={(event) => setSubCategoryFilter(event.target.value)} className="mt-1 h-10 rounded-lg border border-[#E6E1DB] bg-white px-2 text-sm font-normal outline-none"><option value="all">全部</option>{transactionSubcategories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="text-xs font-semibold text-[#777168]">付款方式<select value={paymentMethodFilter} onChange={(event) => setPaymentMethodFilter(event.target.value)} className="mt-1 h-10 rounded-lg border border-[#E6E1DB] bg-white px-2 text-sm font-normal outline-none"><option value="all">全部</option>{transactionMethods.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          {(keyword || startDate || endDate || subCategoryFilter !== "all" || paymentMethodFilter !== "all") && <button type="button" onClick={() => { setKeyword(""); setStartDate(""); setEndDate(""); setSubCategoryFilter("all"); setPaymentMethodFilter("all"); }} className="h-10 text-sm font-semibold text-[#5E7665]">清除條件</button>}
          <span className="pb-2 text-xs text-[#807A71]">顯示 {visibleTransactions.length} 筆</span>
        </div>
        {selectedCreditCardTransactions.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EDE8] bg-[#FFF9F3] px-4 py-3 sm:px-6"><div><b className="text-sm text-[#765534]">已選取 {selectedCreditCardTransactions.length} 筆信用卡代墊款</b><p className="mt-1 text-xs text-[#9A7654]">已知台幣金額 {money(selectedKnownTwdTotal, "TWD")}{selectedForeignCount ? `；另有 ${selectedForeignCount} 筆外幣` : ""}</p></div><div className="flex items-center gap-3"><button type="button" onClick={() => setSelectedCreditCardIds([])} className="text-sm font-semibold text-[#766557]">清除選取</button><button type="button" onClick={openClaimBatch} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#A66932] px-4 text-sm font-semibold text-white">確認總額並一起請款</button></div></div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1370px] text-left">
            <thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-3 py-3 text-center">選取</th><th className="px-6 py-3">日期</th><th className="px-3 py-3">大分類</th><th className="px-3 py-3">小分類</th><th className="px-3 py-3">對象</th><th className="px-3 py-3">方式</th><th className="px-3 py-3">信用卡明細</th><th className="px-3 py-3">請款狀態</th><th className="px-3 py-3">紀錄者</th><th className="px-3 py-3">備註</th><th className="px-3 py-3 text-right">金額</th><th className="px-6 py-3 text-right">操作</th></tr></thead>
            <tbody className="divide-y divide-[#F0EDE8] text-sm">
              {loading ? <tr><td colSpan={12} className="px-6 py-10 text-center text-[#8D877E]">載入收支紀錄中…</td></tr> : visibleTransactions.length ? visibleTransactions.map((transaction) => {
                const creditAdvance = isCreditCardAdvance(transaction);
                const claimed = isClaimed(transaction);
                return <tr key={transaction.id} className="hover:bg-[#FCFBF9]">
                  <td className="px-3 py-4 text-center">{creditAdvance && !claimed ? <input aria-label={`選取 ${transaction.counterparty_name} 的信用卡代墊款`} type="checkbox" checked={selectedCreditCardIds.includes(transaction.id)} onChange={() => toggleCreditCardSelection(transaction)} className="h-4 w-4 rounded border-[#CFC7BD] text-[#A66932] focus:ring-[#D4A77A]" /> : <span className="text-[#C5BEB4]">—</span>}</td>
                  <td className="px-6 py-4 text-[#6F6960]">{transaction.occurred_on.replaceAll("-", "/")}</td>
                  <td className="px-3 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${transaction.direction === "income" ? "bg-[#E7F0E8] text-[#477154]" : "bg-[#FAECDD] text-[#A66932]"}`}>{transactionMajor(transaction)}</span></td>
                  <td className="px-3 py-4 font-semibold text-[#4A4640]">{transactionSub(transaction)}</td>
                  <td className="px-3 py-4 text-[#5C574F]">{transaction.counterparty_name}</td>
                  <td className="px-3 py-4 text-[#6F6960]">{creditAdvance ? <><b className="block">信用卡</b><small className="mt-1 block text-[11px] text-[#8B847A]">代墊款</small></> : transaction.payment_method}</td>
                  <td className="max-w-[170px] px-3 py-4 text-xs text-[#817B72]">{creditAdvance ? [transaction.region, transaction.card_detail].filter(Boolean).join(" · ") || "—" : "—"}</td>
                  <td className="px-3 py-4 text-xs">{creditAdvance ? claimed ? <span className="inline-flex rounded-full bg-[#E7F0E8] px-2.5 py-1 font-semibold text-[#477154]">{transaction.credit_card_claim_batch_id ? "合併已請款" : "已請款"}</span> : <span className="inline-flex rounded-full bg-[#FFF2E5] px-2.5 py-1 font-semibold text-[#A66932]">代墊未請款</span> : "—"}{creditAdvance && transaction.credit_card_claim_batches && <small className="mt-1 block text-[#817B72]">帳單總額：{money(Number(transaction.credit_card_claim_batches.total_twd_amount) || 0, "TWD")}</small>}{creditAdvance && !transaction.credit_card_claim_batches && transaction.currency !== "TWD" && <small className="mt-1 block text-[#817B72]">台幣：{transaction.settled_twd_amount ? money(transaction.settled_twd_amount, "TWD") : "待結帳"}</small>}</td>
                  <td className="px-3 py-4 text-[#6F6960]">{transaction.created_by || "—"}</td>
                  <td className="max-w-[150px] truncate px-3 py-4 text-[#817B72]">{transaction.note || "—"}</td>
                  <td className={`px-3 py-4 text-right font-semibold ${transaction.direction === "income" ? "text-[#477154]" : "text-[#A66932]"}`}>{transaction.direction === "income" ? "+" : "−"}{money(transaction.amount, transaction.currency)}</td>
                  <td className="px-6 py-4"><div className="flex justify-end gap-3"><button type="button" onClick={() => setSelectedTransaction(transaction)} className="text-sm font-semibold text-[#5E7665]">查看</button>{creditAdvance && !claimed && <button type="button" onClick={() => openCreditCardEditor(transaction)} className="text-sm font-semibold text-[#5E7665]">編輯</button>}{creditAdvance && !claimed && <button type="button" onClick={() => openCreditCardEditor(transaction)} className="text-sm font-semibold text-[#A66932]">單筆請款</button>}{!claimed && <button type="button" onClick={() => { void deleteTransaction(transaction); }} disabled={deletingId === transaction.id} className="text-sm font-semibold text-[#A35F37] disabled:cursor-not-allowed disabled:opacity-45">{deletingId === transaction.id ? "刪除中…" : "刪除"}</button>}</div></td>
                </tr>;
              }) : <tr><td colSpan={12} className="px-6 py-12 text-center text-[#8D877E]">尚無收支紀錄。請從右側新增第一筆記帳。</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${cardClass} h-fit p-5 sm:p-6`}><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">NEW ENTRY</p><h2 className="mt-2 text-xl font-semibold">新增收支紀錄</h2><p className="mt-2 text-sm leading-6 text-[#898379]">先選擇大分類與小分類，再填寫對象、付款方式與金額。</p><form className="mt-5 space-y-4" onSubmit={(event) => { void submit(event); }}><div className="grid grid-cols-3 gap-2">{([ ["income", "收入"], ["expense", "支出"], ["opening", "期初現金"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setMajorCategory(value)} className={`min-h-12 rounded-xl border px-2 text-xs font-semibold ${majorCategory === value ? "border-[#87A18D] bg-[#EDF5EE] text-[#426349]" : "border-[#E5E1DB] bg-white text-[#777168] hover:bg-[#FCFBF9]"}`}>{label}</button>)}</div>
        {majorCategory !== "opening" && <label className="block text-sm font-semibold text-[#58534C]">小分類<div className="mt-2 grid grid-cols-3 gap-2">{(majorCategory === "income" ? incomeSubcategories : expenseSubcategories).map((item) => <button key={item} type="button" onClick={() => setSubCategory(item)} className={`min-h-10 rounded-xl border px-2 text-xs font-semibold ${subCategory === item ? "border-[#9EBAA4] bg-[#F2F7F2] text-[#426349]" : "border-[#E5E1DB] bg-white text-[#777168]"}`}>{item}</button>)}</div></label>}
        {requiresOrder && <label className="block text-sm font-semibold text-[#58534C]">連結訂單<select value={orderId} onChange={(event) => setOrderId(event.target.value)} className={inputClass} required><option value="">選擇要結帳的訂單</option>{orders.filter((order) => order.status !== "已取消").map((order) => <option key={order.id} value={order.id}>{order.order_number} · {order.customers?.name || "未指定客戶"} · {order.order_date} · {order.reconciliation_status}</option>)}</select>{!orders.length && !loading && <small className="mt-2 block text-xs font-normal text-[#A66932]">尚無可連結的訂單，請先建立訂單。</small>}</label>}
        {requiresSupplier && <label className="block text-sm font-semibold text-[#58534C]">供應商<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={inputClass} required><option value="">選擇供應商</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.country ? ` · ${supplier.country}` : ""}</option>)}</select>{!suppliers.length && !loading && <small className="mt-2 block text-xs font-normal text-[#A66932]">尚未建立供應商，請先到採購與供應商新增資料。</small>}</label>}
        {majorCategory !== "opening" && !requiresOrder && !requiresSupplier && <label className="block text-sm font-semibold text-[#58534C]">{counterpartLabel}<input value={counterpartyName} onChange={(event) => setCounterpartyName(event.target.value)} placeholder={majorCategory === "income" ? "例如：零售客人姓名" : "例如：物流費用"} className={inputClass} required /></label>}
        {majorCategory === "opening" && <div className="rounded-xl bg-[#F8F6F2] px-4 py-3 text-xs leading-5 text-[#776F65]">第一次開始記帳時，輸入手上既有的現金。之後的現金收款與現金支出會自動加減餘額。</div>}
        <div className="grid gap-4 sm:grid-cols-3"><label className="block text-sm font-semibold text-[#58534C]">收支日期<input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} className={inputClass} required /></label><label className="block text-sm font-semibold text-[#58534C]">付款方式<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={inputClass}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label><label className="block text-sm font-semibold text-[#58534C]">幣別<select value={currency} disabled={isCreditCardExpense && Boolean(regionCurrency[region])} onChange={(event) => setCurrency(event.target.value as CurrencyCode)} className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}>{currencies.map((item) => <option key={item} value={item}>{currencyLabel[item]}（{currencySymbol[item]}）</option>)}</select></label></div>
        {isCreditCardExpense && <div className="rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] p-4"><p className="text-sm font-semibold text-[#58534C]">信用卡代墊款明細</p><p className="mt-1 text-xs leading-5 text-[#8B847A]">選擇刷卡地區後會自動帶入幣別；選其他地區可自行選擇幣別。外幣代墊款可在信用卡結帳後補登實際台幣金額並確認請款。</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-[#58534C]">刷卡地區<select value={region} onChange={(event) => setRegion(event.target.value)} className={inputClass}>{Object.keys(regionCurrency).map((item) => <option key={item}>{item}</option>)}</select></label><label className="block text-sm font-semibold text-[#58534C]">明細／商家<input value={cardDetail} onChange={(event) => setCardDetail(event.target.value)} placeholder="例如：Olive Young 弘大店" className={inputClass} required /></label></div></div>}
        <label className="block text-sm font-semibold text-[#58534C]">金額<input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="輸入金額" className={inputClass} required /></label><label className="block text-sm font-semibold text-[#58534C]">備註<span className="ml-1 text-xs font-normal text-[#9B958C]">（選填）</span><textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 py-3 text-sm font-normal text-[#49443D] outline-none focus:border-[#89A58E]" placeholder="例如：8 月貨款、客戶訂單尾款" /></label><button type="submit" disabled={saving || setupRequired} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white transition hover:bg-[#46423D] disabled:cursor-not-allowed disabled:opacity-45">{saving ? "儲存中…" : "儲存收支紀錄"}</button></form></section>
    </div>

    {selectedTransaction && <div className="fixed inset-0 z-50 flex items-end bg-[#292824]/35 sm:items-center sm:justify-center sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="transaction-detail-title" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">TRANSACTION DETAIL</p><h2 id="transaction-detail-title" className="mt-2 text-xl font-semibold">收支紀錄明細</h2><p className="mt-2 text-sm text-[#7D776E]">可確認這筆收支的分類、金額、紀錄者與付款內容。</p></div>
          <button type="button" aria-label="關閉收支紀錄明細" onClick={() => setSelectedTransaction(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg text-[#777168]">×</button>
        </div>
        <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-[#ECE8E2] bg-[#ECE8E2] sm:grid-cols-2">
          {[["收支日期", selectedTransaction.occurred_on.replaceAll("-", "/")], ["大分類", transactionMajor(selectedTransaction)], ["小分類", transactionSub(selectedTransaction)], ["收支對象", selectedTransaction.counterparty_name || "—"], ["付款方式", selectedTransaction.payment_method], ["幣別", currencyLabel[selectedTransaction.currency]], ["金額", `${selectedTransaction.direction === "income" ? "+" : "−"}${money(selectedTransaction.amount, selectedTransaction.currency)}`], ["信用卡明細", isCreditCardAdvance(selectedTransaction) ? [selectedTransaction.region, selectedTransaction.card_detail].filter(Boolean).join(" · ") || "—" : "—"], ["請款狀態", isCreditCardAdvance(selectedTransaction) ? isClaimed(selectedTransaction) ? selectedTransaction.credit_card_claim_batch_id ? "合併請款（已鎖定）" : "已請款（已鎖定）" : "代墊未請款" : "—"], ["信用卡結帳台幣金額", isCreditCardAdvance(selectedTransaction) ? selectedTransaction.credit_card_claim_batches ? `合併帳單 ${money(Number(selectedTransaction.credit_card_claim_batches.total_twd_amount) || 0, "TWD")}` : selectedTransaction.settled_twd_amount ? money(selectedTransaction.settled_twd_amount, "TWD") : "待信用卡結帳後補登" : "—"], ["合併請款筆數", selectedTransaction.credit_card_claim_batches ? `${selectedTransaction.credit_card_claim_batches.entry_count} 筆` : "—"], ["紀錄者", selectedTransaction.created_by || "—"], ["請款確認者", selectedTransaction.credit_card_claimed_by || "—"], ["建立時間", new Date(selectedTransaction.created_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })], ["備註", selectedTransaction.note || "—"]].map(([label, value]) => <div key={label} className={`bg-white p-4 ${label === "備註" ? "sm:col-span-2" : ""}`}><p className="text-xs font-semibold text-[#938D84]">{label}</p><p className={`mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 ${label === "金額" ? selectedTransaction.direction === "income" ? "text-[#477154]" : "text-[#A66932]" : "text-[#48433C]"}`}>{value}</p></div>)}
        </div>
        <p className="mt-5 rounded-xl bg-[#F8F6F2] p-4 text-xs leading-5 text-[#746D63]">{isCreditCardAdvance(selectedTransaction) && isClaimed(selectedTransaction) ? "這筆信用卡代墊款已確認請款，為保留帳務紀錄已鎖定，不可修改或刪除。" : "刪除後，系統會自動回復這筆交易對現金餘額與收支統計的影響。"}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setSelectedTransaction(null)} disabled={deletingId === selectedTransaction.id} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-4 text-sm font-semibold text-[#5E7665] disabled:opacity-45">關閉</button>{isCreditCardAdvance(selectedTransaction) && !isClaimed(selectedTransaction) && <button type="button" onClick={() => openCreditCardEditor(selectedTransaction)} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-4 text-sm font-semibold text-[#5E7665]">編輯代墊款／確認請款</button>}{!isClaimed(selectedTransaction) && <button type="button" onClick={() => { void deleteTransaction(selectedTransaction); }} disabled={deletingId === selectedTransaction.id} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#F0D6C2] bg-white px-4 text-sm font-semibold text-[#A35F37] disabled:opacity-45">{deletingId === selectedTransaction.id ? "刪除中…" : "刪除這筆紀錄"}</button>}</div>
      </div>
    </div>}
    {claimBatchOpen && <div className="fixed inset-0 z-[60] flex items-end bg-[#292824]/35 sm:items-center sm:justify-center sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="credit-card-batch-title" className="w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CREDIT CARD CLAIM</p><h2 id="credit-card-batch-title" className="mt-2 text-xl font-semibold">合併請款結清</h2><p className="mt-2 text-sm leading-6 text-[#7D776E]">確認信用卡帳單的實際台幣總額後，會將選取的代墊款一起鎖定，之後不可再修改或刪除。</p></div><button type="button" aria-label="關閉合併請款" onClick={() => setClaimBatchOpen(false)} disabled={claimBatchSaving} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg text-[#777168] disabled:opacity-45">×</button></div>
        <div className="mt-5 rounded-2xl bg-[#FFF9F3] p-4"><div className="flex justify-between gap-4 text-sm"><span className="text-[#786452]">選取代墊款</span><b>{selectedCreditCardTransactions.length} 筆</b></div><div className="mt-3 flex justify-between gap-4 text-sm"><span className="text-[#786452]">已知台幣代墊款</span><b>{money(selectedKnownTwdTotal, "TWD")}</b></div>{selectedForeignCount > 0 && <p className="mt-3 text-xs leading-5 text-[#8D7159]">包含 {selectedForeignCount} 筆外幣代墊款，請依信用卡帳單填寫下方實際台幣總額。</p>}</div>
        <label className="mt-5 block text-sm font-semibold text-[#58534C]">本次信用卡帳單台幣總額<input type="number" min={Math.max(1, selectedKnownTwdTotal)} step="1" value={claimBatchTotal} onChange={(event) => setClaimBatchTotal(event.target.value)} placeholder="輸入信用卡帳單上的實際總額" className={inputClass} required /><small className="mt-2 block text-xs font-normal leading-5 text-[#8B847A]">金額不可低於已選取的台幣代墊款；若包含外幣，這裡請填信用卡實際結帳金額。</small></label>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setClaimBatchOpen(false)} disabled={claimBatchSaving} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-4 text-sm font-semibold text-[#5E7665] disabled:opacity-45">取消</button><button type="button" onClick={() => { void claimCreditCardBatch(); }} disabled={claimBatchSaving || !claimBatchTotal.trim()} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#A66932] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{claimBatchSaving ? "請款中…" : "確認並一起請款結清"}</button></div>
      </div>
    </div>}
    {creditCardDraft && <div className="fixed inset-0 z-[60] flex items-end bg-[#292824]/35 sm:items-center sm:justify-center sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="credit-card-advance-title" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CREDIT CARD ADVANCE</p><h2 id="credit-card-advance-title" className="mt-2 text-xl font-semibold">編輯信用卡代墊款</h2><p className="mt-2 text-sm leading-6 text-[#7D776E]">外幣刷卡可在信用卡結帳後補上實際台幣金額。確認請款後，這筆紀錄會鎖定。</p></div><button type="button" aria-label="關閉信用卡代墊款編輯" onClick={() => setCreditCardDraft(null)} disabled={creditSaving} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg text-[#777168] disabled:opacity-45">×</button></div>
        <div className="mt-6 space-y-4"><label className="block text-sm font-semibold text-[#58534C]">支出小分類<div className="mt-2 grid grid-cols-3 gap-2">{expenseSubcategories.map((item) => <button key={item} type="button" onClick={() => updateCreditCardDraft({ subCategory: item, supplierId: item === "供應商貨款" ? creditCardDraft.supplierId : "" })} className={`min-h-10 rounded-xl border px-2 text-xs font-semibold ${creditCardDraft.subCategory === item ? "border-[#D4A77A] bg-[#FFF4E8] text-[#A66932]" : "border-[#E5E1DB] bg-white text-[#777168]"}`}>{item}</button>)}</div></label>
          {creditCardDraft.subCategory === "供應商貨款" ? <label className="block text-sm font-semibold text-[#58534C]">供應商<select value={creditCardDraft.supplierId} onChange={(event) => updateCreditCardDraft({ supplierId: event.target.value })} className={inputClass} required><option value="">選擇供應商</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.country ? ` · ${supplier.country}` : ""}</option>)}</select></label> : <label className="block text-sm font-semibold text-[#58534C]">支出對象<input value={creditCardDraft.counterpartyName} onChange={(event) => updateCreditCardDraft({ counterpartyName: event.target.value })} className={inputClass} required /></label>}
          <div className="grid gap-4 sm:grid-cols-3"><label className="block text-sm font-semibold text-[#58534C]">刷卡日期<input type="date" value={creditCardDraft.occurredOn} onChange={(event) => updateCreditCardDraft({ occurredOn: event.target.value })} className={inputClass} required /></label><label className="block text-sm font-semibold text-[#58534C]">刷卡幣別<select value={creditCardDraft.currency} onChange={(event) => updateCreditCardDraft({ currency: event.target.value as CurrencyCode })} className={inputClass}>{currencies.map((item) => <option key={item} value={item}>{currencyLabel[item]}（{currencySymbol[item]}）</option>)}</select></label><label className="block text-sm font-semibold text-[#58534C]">原始刷卡金額<input type="number" min="1" step="1" value={creditCardDraft.amount} onChange={(event) => updateCreditCardDraft({ amount: event.target.value })} className={inputClass} required /></label></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-[#58534C]">刷卡地區<select value={creditCardDraft.region} onChange={(event) => { const nextRegion = event.target.value; updateCreditCardDraft({ region: nextRegion, currency: regionCurrency[nextRegion] || creditCardDraft.currency }); }} className={inputClass}>{Object.keys(regionCurrency).map((item) => <option key={item}>{item}</option>)}</select></label><label className="block text-sm font-semibold text-[#58534C]">明細／商家<input value={creditCardDraft.cardDetail} onChange={(event) => updateCreditCardDraft({ cardDetail: event.target.value })} className={inputClass} required /></label></div>
          {creditCardDraft.currency !== "TWD" && <label className="block rounded-xl border border-[#EAD7C4] bg-[#FFF9F3] p-4 text-sm font-semibold text-[#735B45]">信用卡結帳台幣金額<input type="number" min="1" step="1" value={creditCardDraft.settledTwdAmount} onChange={(event) => updateCreditCardDraft({ settledTwdAmount: event.target.value })} placeholder="信用卡結帳後填入實際台幣金額" className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-white px-3 text-sm font-normal text-[#49443D] outline-none" /><small className="mt-2 block text-xs font-normal leading-5">可先儲存代墊款；確認已請款時必須填寫這個實際台幣金額。</small></label>}
          <label className="block text-sm font-semibold text-[#58534C]">備註<span className="ml-1 text-xs font-normal text-[#9B958C]">（選填）</span><textarea value={creditCardDraft.note} onChange={(event) => updateCreditCardDraft({ note: event.target.value })} className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 py-3 text-sm font-normal text-[#49443D] outline-none focus:border-[#89A58E]" /></label></div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setCreditCardDraft(null)} disabled={creditSaving} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-4 text-sm font-semibold text-[#5E7665] disabled:opacity-45">取消</button><button type="button" onClick={() => { void saveCreditCardAdvance(false); }} disabled={creditSaving} className="inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-4 text-sm font-semibold text-[#5E7665] disabled:opacity-45">{creditSaving ? "儲存中…" : "儲存修改"}</button><button type="button" onClick={() => { void saveCreditCardAdvance(true); }} disabled={creditSaving || (creditCardDraft.currency !== "TWD" && !creditCardDraft.settledTwdAmount.trim())} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#A66932] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">確認已請款並鎖定</button></div>
      </div>
    </div>}
  </>;
}
