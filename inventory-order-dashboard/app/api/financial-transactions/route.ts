import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type FinancialTransactionInput = {
  entryType?: unknown;
  customerId?: unknown;
  supplierId?: unknown;
  paymentMethod?: unknown;
  currency?: unknown;
  amount?: unknown;
  occurredOn?: unknown;
  note?: unknown;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const entryTypes = ["customer_payment", "supplier_payment", "opening_cash"] as const;
const currencies = ["TWD", "KRW", "JPY"] as const;
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

const missingFinancialTable = (error: unknown) => {
  const message = errorMessage(error, "");
  return (typeof error === "object" && error !== null && (error as { code?: string }).code === "PGRST205")
    || /financial_transactions/i.test(message) && /(schema cache|does not exist|could not find)/i.test(message);
};

function validateInput(input: FinancialTransactionInput) {
  const entryType = text(input.entryType);
  const customerId = text(input.customerId);
  const supplierId = text(input.supplierId);
  const paymentMethod = text(input.paymentMethod);
  const currency = text(input.currency) || "TWD";
  const amount = positiveInteger(input.amount);
  const occurredOn = text(input.occurredOn);
  const note = text(input.note);

  if (!entryTypes.includes(entryType as (typeof entryTypes)[number])) return { error: "收支類型不正確。" };
  if (amount === null) return { error: "金額必須是大於 0 的整數。" };
  if (!datePattern.test(occurredOn)) return { error: "日期格式不正確。" };
  if (!currencies.includes(currency as (typeof currencies)[number])) return { error: "幣別不正確。" };

  if (entryType === "customer_payment") {
    if (!uuidPattern.test(customerId)) return { error: "請選擇已建立的客戶。" };
    if (!["現金", "轉帳"].includes(paymentMethod)) return { error: "客戶付款方式僅限現金或轉帳。" };
  }

  if (entryType === "supplier_payment") {
    if (!uuidPattern.test(supplierId)) return { error: "請選擇已建立的供應商。" };
    if (!["匯款", "現金", "信用卡"].includes(paymentMethod)) return { error: "供應商貨款方式不正確。" };
  }

  if (entryType === "opening_cash" && paymentMethod !== "現金") return { error: "期初現金須以現金記錄。" };

  return { entryType, customerId, supplierId, paymentMethod, currency, amount, occurredOn, note };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;

    const { data, error } = await getSupabaseAdmin()
      .from("financial_transactions")
      .select("id, entry_type, direction, payment_method, currency, amount, occurred_on, counterparty_name, note, created_by, created_at")
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const transactions = (data ?? []).map((transaction) => ({ ...transaction, currency: transaction.currency || "TWD" }));
    const cashBalances = transactions.reduce<Record<(typeof currencies)[number], number>>((balances, transaction) => {
      if (transaction.payment_method !== "現金") return balances;
      balances[transaction.currency as (typeof currencies)[number]] += transaction.direction === "income" ? transaction.amount : -transaction.amount;
      return balances;
    }, { TWD: 0, KRW: 0, JPY: 0 });

    return withRefreshedSession(NextResponse.json({ transactions, cashBalances }), auth.context);
  } catch (error) {
    if (missingFinancialTable(error)) {
      return NextResponse.json({ message: "收支資料庫尚未建立。請先執行本次新增的資料庫設定。", setupRequired: true }, { status: 503 });
    }
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
    let counterpartyName = "期初現金";
    let customerId: string | null = null;
    let supplierId: string | null = null;
    let direction: "income" | "expense" = "income";

    if (validation.entryType === "customer_payment") {
      const { data: customer, error } = await supabase.from("customers").select("id, name").eq("id", validation.customerId).maybeSingle();
      if (error) throw error;
      if (!customer) return NextResponse.json({ message: "找不到選擇的客戶。" }, { status: 400 });
      counterpartyName = customer.name;
      customerId = customer.id;
    }

    if (validation.entryType === "supplier_payment") {
      const { data: supplier, error } = await supabase.from("suppliers").select("id, name").eq("id", validation.supplierId).maybeSingle();
      if (error) throw error;
      if (!supplier) return NextResponse.json({ message: "找不到選擇的供應商。" }, { status: 400 });
      counterpartyName = supplier.name;
      supplierId = supplier.id;
      direction = "expense";
    }

    const { data, error } = await supabase
      .from("financial_transactions")
      .insert({
        entry_type: validation.entryType,
        direction,
        payment_method: validation.paymentMethod,
        currency: validation.currency,
        amount: validation.amount,
        occurred_on: validation.occurredOn,
        counterparty_name: counterpartyName,
        customer_id: customerId,
        supplier_id: supplierId,
        note: validation.note,
        created_by: auth.context.profile.displayName,
      })
      .select("id, entry_type, direction, payment_method, currency, amount, occurred_on, counterparty_name, note, created_by, created_at")
      .single();
    if (error) throw error;

    return withRefreshedSession(NextResponse.json({ transaction: data }, { status: 201 }), auth.context);
  } catch (error) {
    if (missingFinancialTable(error)) {
      return NextResponse.json({ message: "收支資料庫尚未建立。請先執行本次新增的資料庫設定。", setupRequired: true }, { status: 503 });
    }
    return NextResponse.json({ message: errorMessage(error, "無法儲存收支紀錄。") }, { status: 500 });
  }
}
