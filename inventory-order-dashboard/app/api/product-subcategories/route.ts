import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function validateParent(country: string, category: string) {
  if (!country || !category) return "請先選擇國家與商品分類。";
  if (country.length > 30 || category.length > 40) return "分類資料不正確。";
  return "";
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;

    const { searchParams } = new URL(request.url);
    const country = text(searchParams.get("country"));
    const category = text(searchParams.get("category"));
    const parentError = validateParent(country, category);
    if (parentError) return NextResponse.json({ message: parentError }, { status: 400 });

    const { data, error } = await getSupabaseAdmin()
      .from("product_subcategories")
      .select("id, country, category, name, created_at")
      .eq("country", country)
      .eq("category", category)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return withRefreshedSession(NextResponse.json({ subcategories: data ?? [] }), auth.context);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "無法讀取自訂子分類。" },
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
    const category = text(body.category);
    const name = text(body.name);
    const parentError = validateParent(country, category);
    if (parentError) return NextResponse.json({ message: parentError }, { status: 400 });
    if (!name || name.length > 60) return NextResponse.json({ message: "子分類名稱請填寫 1 到 60 個字。" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabase
      .from("product_subcategories")
      .select("id, country, category, name, created_at")
      .eq("country", country)
      .eq("category", category)
      .eq("name", name)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return withRefreshedSession(NextResponse.json({ subcategory: existing }), auth.context);

    const { data, error } = await supabase
      .from("product_subcategories")
      .insert({ country, category, name, created_by: auth.context.profile.displayName })
      .select("id, country, category, name, created_at")
      .single();
    if (error) throw error;

    return withRefreshedSession(NextResponse.json({ subcategory: data }, { status: 201 }), auth.context);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "無法新增自訂子分類。" },
      { status: 500 },
    );
  }
}
