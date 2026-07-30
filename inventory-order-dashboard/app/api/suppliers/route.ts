import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type SupplierInput = {
  name?: unknown;
  country?: unknown;
  transactionMethod?: unknown;
  moq?: unknown;
  paymentMethod?: unknown;
};

const paymentMethods = ["現金", "轉帳", "信用卡"];
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function validateSupplier(input: SupplierInput) {
  const supplier = {
    name: text(input.name),
    country: text(input.country),
    transaction_method: text(input.transactionMethod),
    moq: text(input.moq),
    payment_method: text(input.paymentMethod) || "轉帳",
  };
  if (!supplier.name) return { error: "請填寫供應商名稱。" };
  if (!supplier.country) return { error: "請填寫供應商國家。" };
  if (!paymentMethods.includes(supplier.payment_method)) return { error: "付款方式不正確。" };
  return { supplier };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { data, error } = await getSupabaseAdmin()
      .from("suppliers")
      .select("id, name, country, transaction_method, moq, payment_method, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ suppliers: data }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法讀取供應商資料。" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const validation = validateSupplier(await request.json());
    if ("error" in validation) return NextResponse.json(validation, { status: 400 });
    const { data, error } = await getSupabaseAdmin()
      .from("suppliers")
      .insert(validation.supplier)
      .select("id, name, country, transaction_method, moq, payment_method, created_at, updated_at")
      .single();
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ supplier: data }, { status: 201 }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法建立供應商資料。" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const body = await request.json();
    if (typeof body.id !== "string" || !body.id) return NextResponse.json({ message: "供應商資料不正確。" }, { status: 400 });
    const validation = validateSupplier(body);
    if ("error" in validation) return NextResponse.json(validation, { status: 400 });
    const { data, error } = await getSupabaseAdmin()
      .from("suppliers")
      .update(validation.supplier)
      .eq("id", body.id)
      .select("id, name, country, transaction_method, moq, payment_method, created_at, updated_at")
      .single();
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ supplier: data }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法更新供應商資料。" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ message: "缺少供應商資料。" }, { status: 400 });
    const { error } = await getSupabaseAdmin().from("suppliers").delete().eq("id", id);
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ ok: true }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "無法刪除供應商資料。" }, { status: 500 });
  }
}
