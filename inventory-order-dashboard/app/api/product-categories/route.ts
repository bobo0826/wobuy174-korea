import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function validateCountry(country: string) {
  if (!country) return "請先選擇國家。";
  if (country.length > 30) return "國家資料不正確。";
  return "";
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;

    const country = text(new URL(request.url).searchParams.get("country"));
    const countryError = validateCountry(country);
    if (countryError) return NextResponse.json({ message: countryError }, { status: 400 });

    const { data, error } = await getSupabaseAdmin()
      .from("product_categories")
      .select("id, country, name, created_at")
      .eq("country", country)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return withRefreshedSession(NextResponse.json({ categories: data ?? [] }), auth.context);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "無法讀取自訂商品分類。" },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;

    const body = await request.json();
    const country = text(body.country);
    const name = text(body.name);
    const countryError = validateCountry(country);
    if (countryError) return NextResponse.json({ message: countryError }, { status: 400 });
    if (!name || name.length > 60) return NextResponse.json({ message: "商品分類名稱請填寫 1 到 60 個字。" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabase
      .from("product_categories")
      .select("id, country, name, created_at")
      .eq("country", country)
      .eq("name", name)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return withRefreshedSession(NextResponse.json({ category: existing }), auth.context);

    const { data, error } = await supabase
      .from("product_categories")
      .insert({ country, name, created_by: auth.context.profile.displayName })
      .select("id, country, name, created_at")
      .single();
    if (error) throw error;

    return withRefreshedSession(NextResponse.json({ category: data }, { status: 201 }), auth.context);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "無法新增商品分類。" },
      { status: 500 },
    );
  }
}
