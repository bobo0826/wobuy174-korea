import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const validRole = (value: unknown): value is "admin" | "staff" => value === "admin" || value === "staff";
const cleanText = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.context) return auth.response!;
    const { data, error } = await getSupabaseAdmin()
      .from("user_profiles")
      .select("id, email, display_name, role, created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ users: data }), auth.context);
  } catch {
    return NextResponse.json({ message: "無法讀取帳號清單。" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.context) return auth.response!;
    const { email, password, displayName, role } = await request.json();
    const cleanEmail = cleanText(email);
    const cleanName = cleanText(displayName) || cleanEmail.split("@")[0];
    if (!cleanEmail || typeof password !== "string" || password.length < 8 || !validRole(role)) {
      return NextResponse.json({ message: "請填寫 Email、至少 8 碼密碼與帳號角色。" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { display_name: cleanName },
    });
    if (createError || !created.user) return NextResponse.json({ message: createError?.message ?? "無法建立帳號。" }, { status: 400 });

    const { data, error } = await supabase.from("user_profiles").upsert({
      id: created.user.id,
      email: cleanEmail,
      display_name: cleanName,
      role,
    }).select("id, email, display_name, role, created_at").single();
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ user: data }, { status: 201 }), auth.context);
  } catch {
    return NextResponse.json({ message: "無法建立帳號。" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.context) return auth.response!;
    const { id, role } = await request.json();
    if (typeof id !== "string" || !validRole(role)) return NextResponse.json({ message: "帳號資料不正確。" }, { status: 400 });
    if (id === auth.context.profile.id && role !== "admin") return NextResponse.json({ message: "不可移除自己的系統管理員權限。" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: target, error: targetError } = await supabase.from("user_profiles").select("role").eq("id", id).single();
    if (targetError) throw targetError;
    if (target.role === "admin" && role === "staff") {
      const { count, error: countError } = await supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
      if (countError) throw countError;
      if ((count ?? 0) <= 1) return NextResponse.json({ message: "系統至少需要保留一位管理員。" }, { status: 400 });
    }

    const { data, error } = await supabase.from("user_profiles").update({ role }).eq("id", id).select("id, email, display_name, role, created_at").single();
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ user: data }), auth.context);
  } catch {
    return NextResponse.json({ message: "無法更新帳號權限。" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.context) return auth.response!;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ message: "缺少帳號資料。" }, { status: 400 });
    if (id === auth.context.profile.id) return NextResponse.json({ message: "不可刪除目前登入的帳號。" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: target, error: targetError } = await supabase.from("user_profiles").select("role").eq("id", id).single();
    if (targetError) throw targetError;
    if (target.role === "admin") {
      const { count, error: countError } = await supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
      if (countError) throw countError;
      if ((count ?? 0) <= 1) return NextResponse.json({ message: "系統至少需要保留一位管理員。" }, { status: 400 });
    }

    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ ok: true }), auth.context);
  } catch {
    return NextResponse.json({ message: "無法刪除帳號。" }, { status: 500 });
  }
}
