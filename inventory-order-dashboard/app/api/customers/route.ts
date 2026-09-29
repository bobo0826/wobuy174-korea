import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type CustomerInput = {
  name?: unknown;
  lineName?: unknown;
  customerCategory?: unknown;
  preferredDeliveryMethod?: unknown;
  phone?: unknown;
  address?: unknown;
};

const cleanText = (value: unknown) => typeof value === "string" ? value.trim() : "";
const customerCategories = ["員工", "社群"];
const deliveryMethods = ["自取", "賣貨便"];
const customerSelect = "id, name, line_name, customer_category, preferred_delivery_method, phone, address, created_at, updated_at";

function validateCustomer(input: CustomerInput) {
  const customer = {
    name: cleanText(input.name),
    line_name: cleanText(input.lineName),
    customer_category: cleanText(input.customerCategory) || "社群",
    preferred_delivery_method: cleanText(input.preferredDeliveryMethod) || "自取",
    phone: cleanText(input.phone),
    address: cleanText(input.address),
  };

  if (!customer.name) return { error: "請填寫客戶姓名。" };
  if (!customerCategories.includes(customer.customer_category)) return { error: "客戶類別不正確。" };
  if (!deliveryMethods.includes(customer.preferred_delivery_method)) return { error: "常用交易方式不正確。" };
  return { customer };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { data, error } = await getSupabaseAdmin()
      .from("customers")
      .select(customerSelect)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ customers: data }), auth.context);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "無法讀取客戶資料。" },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const validation = validateCustomer(await request.json());
    if ("error" in validation) return NextResponse.json(validation, { status: 400 });

    const { data, error } = await getSupabaseAdmin()
      .from("customers")
      .insert(validation.customer)
      .select(customerSelect)
      .single();
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ customer: data }, { status: 201 }), auth.context);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "無法建立客戶資料。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const body = await request.json();
    if (typeof body.id !== "string" || !body.id) return NextResponse.json({ message: "客戶資料不正確。" }, { status: 400 });
    const validation = validateCustomer(body);
    if ("error" in validation) return NextResponse.json(validation, { status: 400 });

    const { data, error } = await getSupabaseAdmin()
      .from("customers")
      .update(validation.customer)
      .eq("id", body.id)
      .select(customerSelect)
      .single();
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ customer: data }), auth.context);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "無法更新客戶資料。" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ message: "缺少客戶資料。" }, { status: 400 });

    const { error } = await getSupabaseAdmin().from("customers").delete().eq("id", id);
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ ok: true }), auth.context);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "無法刪除客戶資料。" },
      { status: 500 },
    );
  }
}
