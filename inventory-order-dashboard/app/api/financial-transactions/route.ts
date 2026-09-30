import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type FinancialTransactionInput = {
  majorCategory?: unknown;
  subCategory?: unknown;
  orderId?: unknown;
  customerId?: unknown;
  supplierId?: unknown;
  counterpartyName?: unknown;
  paymentMethod?: unknown;
  currency?: unknown;
  region?: unknown;
  cardDetail?: unknown;
  amount?: unknown;
  occurredOn?: unknown;
  note?: unknown;
  settledTwdAmount?: unknown;
};

type CreditCardUpdateInput = FinancialTransactionInput & {
  id?: unknown;
  action?: unknown;
  ids?: unknown;
  totalTwdAmount?: unknown;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const currencies = ["TWD", "KRW", "JPY"] as const;
const incomeSubcategories = ["訂單結帳", "零售購買", "其他"] as const;
const expenseSubcategories = ["供應商貨款", "貨款請款", "其他"] as const;
const regionCurrency: Record<string, (typeof currencies)[number] | null> = { "台灣": "TWD", "韓國": "KRW", "日本": "JPY", "其他": null };
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const positiveInteger = (value: unknown) => {
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0 ? amount : null;
};
const optionalPositiveInteger = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  return positiveInteger(value);
};

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
};

const missingFinancialSetup = (error: unknown) => {
  const message = errorMessage(error, "");
  return (typeof error === "object" && error !== null && (error as { code?: string }).code === "PGRST205")
    || /(financial_transactions|credit_card_claim_batches)/i.test(message) && /(schema cache|does not exist|could not find|column)/i.test(message);
};

function validateInput(input: FinancialTransactionInput) {
  const majorCategory = text(input.majorCategory);
  const subCategory = text(input.subCategory);
  const orderId = text(input.orderId);
  const customerId = text(input.customerId);
  const supplierId = text(input.supplierId);
  const counterpartyName = text(input.counterpartyName);
  const paymentMethod = text(input.paymentMethod);
  const currency = text(input.currency) || "TWD";
  const region = text(input.region);
  const cardDetail = text(input.cardDetail);
  const amount = positiveInteger(input.amount);
  const occurredOn = text(input.occurredOn);
  const note = text(input.note);

  if (!["income", "expense", "opening"].includes(majorCategory)) return { error: "請選擇收入、支出或期初現金。" };
  if (amount === null) return { error: "金額必須是大於 0 的整數。" };
  if (!datePattern.test(occurredOn)) return { error: "日期格式不正確。" };
  if (!currencies.includes(currency as (typeof currencies)[number])) return { error: "幣別不正確。" };

  if (majorCategory === "income") {
    if (!incomeSubcategories.includes(subCategory as (typeof incomeSubcategories)[number])) return { error: "收入小分類不正確。" };
    if (!["現金", "轉帳"].includes(paymentMethod)) return { error: "收入付款方式僅限現金或轉帳。" };
    if (subCategory === "訂單結帳" && !uuidPattern.test(orderId)) return { error: "訂單結帳請選擇既有訂單。" };
    if (subCategory !== "訂單結帳" && !counterpartyName) return { error: "請填寫收款對象。" };
  }

  if (majorCategory === "expense") {
    if (!expenseSubcategories.includes(subCategory as (typeof expenseSubcategories)[number])) return { error: "支出小分類不正確。" };
    if (!["匯款", "現金", "信用卡"].includes(paymentMethod)) return { error: "支出付款方式不正確。" };
    if (subCategory === "供應商貨款" && !uuidPattern.test(supplierId)) return { error: "供應商貨款請選擇已建立的供應商。" };
    if (subCategory !== "供應商貨款" && !counterpartyName) return { error: "請填寫支出對象。" };
    if (paymentMethod === "信用卡") {
      if (!(region in regionCurrency)) return { error: "請選擇刷卡地區。" };
      if (regionCurrency[region] && currency !== regionCurrency[region]) return { error: "刷卡地區與幣別不一致。" };
      if (!cardDetail) return { error: "請填寫信用卡支出明細。" };
    }
  }

  if (majorCategory === "opening" && paymentMethod !== "現金") return { error: "期初現金須以現金記錄。" };
  return { majorCategory, subCategory: majorCategory === "opening" ? "期初現金" : subCategory, orderId, customerId, supplierId, counterpartyName, paymentMethod, currency, region, cardDetail, amount, occurredOn, note };
}

const transactionSelect = "id, entry_type, direction, major_category, sub_category, payment_method, currency, region, card_detail, amount, occurred_on, counterparty_name, customer_id, supplier_id, order_id, settled_twd_amount, credit_card_claimed, credit_card_claimed_at, credit_card_claimed_by, credit_card_claim_batch_id, credit_card_claim_batches(total_twd_amount, entry_count, claimed_at), note, created_by, created_at";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { data, error } = await getSupabaseAdmin().from("financial_transactions").select(transactionSelect).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    const transactions = (data ?? []).map((transaction) => ({ ...transaction, currency: transaction.currency || "TWD" }));
    const cashBalances = transactions.reduce<Record<(typeof currencies)[number], number>>((balances, transaction) => {
      if (transaction.payment_method !== "現金") return balances;
      balances[transaction.currency as (typeof currencies)[number]] += transaction.direction === "income" ? transaction.amount : -transaction.amount;
      return balances;
    }, { TWD: 0, KRW: 0, JPY: 0 });
    return withRefreshedSession(NextResponse.json({ transactions, cashBalances }), auth.context);
  } catch (error) {
    if (missingFinancialSetup(error)) return NextResponse.json({ message: "收支資料庫需要更新，請先執行本次資料庫設定。", setupRequired: true }, { status: 503 });
    return NextResponse.json({ message: errorMessage(error, "無法讀取收支紀錄。") }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const validation = validateInput(await request.json());
    if ("error" in validation) return NextResponse.json(validation, { status: 400 });

    const supabase = getSupabaseAdmin();
    let counterpartyName = validation.majorCategory === "opening" ? "期初現金" : validation.counterpartyName;
    let customerId: string | null = null;
    let supplierId: string | null = null;
    let orderId: string | null = null;
    const direction = validation.majorCategory === "expense" ? "expense" : "income";
    const entryType = validation.majorCategory === "expense" ? "supplier_payment" : validation.majorCategory === "income" ? "customer_payment" : "opening_cash";

    if (validation.majorCategory === "income" && validation.subCategory === "訂單結帳") {
      const { data: order, error } = await supabase.from("orders").select("id, order_number, customer_id, customers(name)").eq("id", validation.orderId).maybeSingle();
      if (error) throw error;
      if (!order) return NextResponse.json({ message: "找不到選擇的訂單。" }, { status: 400 });
      if (!order.customer_id) return NextResponse.json({ message: "這張訂單尚未連結客戶，無法建立訂單結帳紀錄。" }, { status: 400 });
      const linkedCustomer = order.customers as unknown;
      const customerName = Array.isArray(linkedCustomer)
        ? (linkedCustomer[0] as { name?: string } | undefined)?.name
        : (linkedCustomer as { name?: string } | null)?.name;
      counterpartyName = `訂單 ${order.order_number}${customerName ? ` · ${customerName}` : ""}`;
      customerId = order.customer_id;
      orderId = order.id;
    }
    if (validation.majorCategory === "expense" && validation.subCategory === "供應商貨款") {
      const { data: supplier, error } = await supabase.from("suppliers").select("id, name").eq("id", validation.supplierId).maybeSingle();
      if (error) throw error;
      if (!supplier) return NextResponse.json({ message: "找不到選擇的供應商。" }, { status: 400 });
      counterpartyName = supplier.name;
      supplierId = supplier.id;
    }

    const { data, error } = await supabase.from("financial_transactions").insert({
      entry_type: entryType,
      direction,
      major_category: validation.majorCategory === "income" ? "收入" : validation.majorCategory === "expense" ? "支出" : "期初現金",
      sub_category: validation.subCategory,
      payment_method: validation.paymentMethod,
      currency: validation.currency,
      region: validation.paymentMethod === "信用卡" ? validation.region : null,
      card_detail: validation.paymentMethod === "信用卡" ? validation.cardDetail : null,
      amount: validation.amount,
      occurred_on: validation.occurredOn,
      counterparty_name: counterpartyName,
      customer_id: customerId,
      supplier_id: supplierId,
      order_id: orderId,
      note: validation.note,
      created_by: auth.context.profile.displayName,
    }).select(transactionSelect).single();
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ transaction: data }, { status: 201 }), auth.context);
  } catch (error) {
    if (missingFinancialSetup(error)) return NextResponse.json({ message: "收支資料庫需要更新，請先執行本次資料庫設定。", setupRequired: true }, { status: 503 });
    return NextResponse.json({ message: errorMessage(error, "無法儲存收支紀錄。") }, { status: 500 });
  }
}

async function saveCreditCardAdvance(request: NextRequest, input: CreditCardUpdateInput, claim: boolean) {
  const id = text(input.id);
  if (!uuidPattern.test(id)) return NextResponse.json({ message: "收支紀錄不正確。" }, { status: 400 });

  const validation = validateInput({ ...input, majorCategory: "expense", paymentMethod: "信用卡" });
  if ("error" in validation) return NextResponse.json(validation, { status: 400 });
  const settledTwdAmount = optionalPositiveInteger(input.settledTwdAmount);
  if (input.settledTwdAmount !== null && input.settledTwdAmount !== undefined && input.settledTwdAmount !== "" && settledTwdAmount === null) {
    return NextResponse.json({ message: "台幣結帳金額必須是大於 0 的整數。" }, { status: 400 });
  }

  const auth = await requireSignedIn(request);
  if (!auth.context) return auth.response!;
  const supabase = getSupabaseAdmin();
  const { data: current, error: currentError } = await supabase
    .from("financial_transactions")
    .select("id, direction, payment_method, credit_card_claimed")
    .eq("id", id)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current || current.direction !== "expense" || current.payment_method !== "信用卡") {
    return NextResponse.json({ message: "找不到可編輯的信用卡代墊款。" }, { status: 404 });
  }
  if (current.credit_card_claimed) return NextResponse.json({ message: "這筆代墊款已確認請款，無法再修改。" }, { status: 409 });

  let supplierId: string | null = null;
  let counterpartyName = validation.counterpartyName;
  if (validation.subCategory === "供應商貨款") {
    const { data: supplier, error: supplierError } = await supabase.from("suppliers").select("id, name").eq("id", validation.supplierId).maybeSingle();
    if (supplierError) throw supplierError;
    if (!supplier) return NextResponse.json({ message: "找不到選擇的供應商。" }, { status: 400 });
    supplierId = supplier.id;
    counterpartyName = supplier.name;
  }

  const settlementAmount = validation.currency === "TWD" ? validation.amount : settledTwdAmount;
  if (claim && settlementAmount === null) {
    return NextResponse.json({ message: "外幣信用卡代墊款請先填寫信用卡結帳後的實際台幣金額，再確認請款。" }, { status: 400 });
  }
  const { data, error } = await supabase.from("financial_transactions").update({
    major_category: "支出",
    sub_category: validation.subCategory,
    payment_method: "信用卡",
    currency: validation.currency,
    region: validation.region,
    card_detail: validation.cardDetail,
    amount: validation.amount,
    occurred_on: validation.occurredOn,
    counterparty_name: counterpartyName,
    customer_id: null,
    supplier_id: supplierId,
    order_id: null,
    settled_twd_amount: settlementAmount,
    note: validation.note,
    credit_card_claimed: claim,
    credit_card_claimed_at: claim ? new Date().toISOString() : null,
    credit_card_claimed_by: claim ? auth.context.profile.displayName : "",
    credit_card_claim_batch_id: null,
  }).eq("id", id).select(transactionSelect).single();
  if (error) throw error;
  return withRefreshedSession(NextResponse.json({ transaction: data, claimed: claim }), auth.context);
}

async function claimCreditCardBatch(request: NextRequest, input: CreditCardUpdateInput) {
  const auth = await requireSignedIn(request);
  if (!auth.context) return auth.response!;

  const ids = Array.isArray(input.ids)
    ? Array.from(new Set(input.ids.filter((id): id is string => typeof id === "string" && uuidPattern.test(id))))
    : [];
  const totalTwdAmount = positiveInteger(input.totalTwdAmount);
  if (!ids.length || ids.length > 100) return NextResponse.json({ message: "請選擇 1 至 100 筆尚未請款的信用卡代墊款。" }, { status: 400 });
  if (totalTwdAmount === null) return NextResponse.json({ message: "請填寫本次信用卡帳單的台幣總金額。" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: transactions, error: transactionError } = await supabase
    .from("financial_transactions")
    .select("id, payment_method, direction, currency, amount, credit_card_claimed")
    .in("id", ids);
  if (transactionError) throw transactionError;
  if ((transactions ?? []).length !== ids.length) return NextResponse.json({ message: "部分選取的代墊款已不存在，請重新整理後再請款。" }, { status: 409 });
  if ((transactions ?? []).some((transaction) => transaction.direction !== "expense" || transaction.payment_method !== "信用卡" || transaction.credit_card_claimed)) {
    return NextResponse.json({ message: "選取內容含有非信用卡代墊款或已請款資料，請重新整理後再試。" }, { status: 409 });
  }

  const knownTwdTotal = (transactions ?? []).reduce((sum, transaction) => transaction.currency === "TWD" ? sum + Number(transaction.amount) : sum, 0);
  if (totalTwdAmount < knownTwdTotal) {
    return NextResponse.json({ message: `本次帳單總額不可小於已選台幣代墊款 ${knownTwdTotal.toLocaleString("zh-TW")} 元。` }, { status: 400 });
  }

  const claimedAt = new Date().toISOString();
  const { data: batch, error: batchError } = await supabase
    .from("credit_card_claim_batches")
    .insert({ total_twd_amount: totalTwdAmount, entry_count: ids.length, claimed_by: auth.context.profile.displayName, claimed_at: claimedAt })
    .select("id, total_twd_amount, entry_count, claimed_at")
    .single();
  if (batchError) throw batchError;

  const { data: updated, error: updateError } = await supabase
    .from("financial_transactions")
    .update({ credit_card_claimed: true, credit_card_claimed_at: claimedAt, credit_card_claimed_by: auth.context.profile.displayName, credit_card_claim_batch_id: batch.id })
    .in("id", ids)
    .eq("payment_method", "信用卡")
    .eq("credit_card_claimed", false)
    .select("id");
  if (updateError) throw updateError;
  if ((updated ?? []).length !== ids.length) {
    return NextResponse.json({ message: "部分代墊款剛剛已被請款，請重新整理後確認結果。" }, { status: 409 });
  }

  return withRefreshedSession(NextResponse.json({ batch, claimedIds: ids }), auth.context);
}

export async function PATCH(request: NextRequest) {
  try {
    const input = await request.json() as CreditCardUpdateInput;
    const action = text(input.action);
    if (action === "updateCreditCard") return await saveCreditCardAdvance(request, input, false);
    if (action === "claimCreditCard") return await saveCreditCardAdvance(request, input, true);
    if (action === "claimCreditCardBatch") return await claimCreditCardBatch(request, input);
    return NextResponse.json({ message: "不支援的收支更新操作。" }, { status: 400 });
  } catch (error) {
    if (missingFinancialSetup(error)) return NextResponse.json({ message: "收支資料庫需要更新，請先執行本次資料庫設定。", setupRequired: true }, { status: 503 });
    return NextResponse.json({ message: errorMessage(error, "無法更新信用卡代墊款。") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "收支紀錄不正確。" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: transaction, error: readError } = await supabase.from("financial_transactions").select(transactionSelect).eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!transaction) return NextResponse.json({ message: "找不到這筆收支紀錄。" }, { status: 404 });
    if (transaction.payment_method === "信用卡" && transaction.credit_card_claimed) {
      return NextResponse.json({ message: "這筆信用卡代墊款已確認請款，無法刪除。" }, { status: 409 });
    }

    const { error: deleteError } = await supabase.from("financial_transactions").delete().eq("id", id);
    if (deleteError) throw deleteError;

    return withRefreshedSession(NextResponse.json({ ok: true, deletedTransaction: transaction }), auth.context);
  } catch (error) {
    if (missingFinancialSetup(error)) return NextResponse.json({ message: "收支資料庫需要更新，請先執行本次資料庫設定。", setupRequired: true }, { status: 503 });
    return NextResponse.json({ message: errorMessage(error, "無法刪除收支紀錄。") }, { status: 500 });
  }
}
