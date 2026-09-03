import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type FinancialTransactionInput = {
  majorCategory?: unknown;
  subCategory?: unknown;
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
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const currencies = ["TWD", "KRW", "JPY"] as const;
const incomeSubcategories = ["員工購買", "客人購買", "其他"] as const;
const expenseSubcategories = ["供應商貨款", "貨款請款", "其他"] as const;
const regionCurrency: Record<string, (typeof currencies)[number] | null> = { "台灣": "TWD", "韓國": "KRW", "日本": "JPY", "其他": null };
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const positiveInteger = (value: unknown) => {
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0 ? amount : null;
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
    || /financial_transactions/i.test(message) && /(schema cache|does not exist|could not find|column)/i.test(message);
};

function validateInput(input: FinancialTransactionInput) {
  const majorCategory = text(input.majorCategory);
  const subCategory = text(input.subCategory);
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
    if (subCategory === "客人購買" && !uuidPattern.test(customerId)) return { error: "客人購買請選擇已建立的客戶。" };
    if (subCategory !== "客人購買" && !counterpartyName) return { error: "請填寫收款對象。" };
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
  return { majorCategory, subCategory: majorCategory === "opening" ? "期初現金" : subCategory, customerId, supplierId, counterpartyName, paymentMethod, currency, region, cardDetail, amount, occurredOn, note };
}

const transactionSelect = "id, entry_type, direction, major_category, sub_category, payment_method, currency, region, card_detail, amount, occurred_on, counterparty_name, note, created_by, created_at";

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
    const direction = validation.majorCategory === "expense" ? "expense" : "income";
    const entryType = validation.majorCategory === "expense" ? "supplier_payment" : validation.majorCategory === "income" ? "customer_payment" : "opening_cash";

    if (validation.majorCategory === "income" && validation.subCategory === "客人購買") {
      const { data: customer, error } = await supabase.from("customers").select("id, name").eq("id", validation.customerId).maybeSingle();
      if (error) throw error;
      if (!customer) return NextResponse.json({ message: "找不到選擇的客戶。" }, { status: 400 });
      counterpartyName = customer.name;
      customerId = customer.id;
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
