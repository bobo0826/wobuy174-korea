import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { setSessionCookies } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function codeMatches(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName, setupCode } = await request.json();
    const configuredCode = process.env.ADMIN_SETUP_CODE;
    if (!configuredCode) return NextResponse.json({ message: "尚未設定首次管理員設定碼。" }, { status: 503 });
    if (typeof email !== "string" || typeof password !== "string" || typeof setupCode !== "string" || !email.trim() || password.length < 8) {
      return NextResponse.json({ message: "請輸入有效 Email、至少 8 碼密碼與設定碼。" }, { status: 400 });
    }
    if (!codeMatches(setupCode, configuredCode)) return NextResponse.json({ message: "首次設定碼不正確。" }, { status: 403 });

    const supabase = getSupabaseAdmin();
    const { count, error: countError } = await supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if (countError) throw countError;
    if ((count ?? 0) > 0) return NextResponse.json({ message: "系統管理員已建立，請直接登入。" }, { status: 409 });

    const name = typeof displayName === "string" && displayName.trim() ? displayName.trim() : email.trim().split("@")[0];
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    });
    if (createError || !created.user) return NextResponse.json({ message: createError?.message ?? "無法建立帳號。" }, { status: 400 });

    const { error: profileError } = await supabase.from("user_profiles").upsert({
      id: created.user.id,
      email: email.trim(),
      display_name: name,
      role: "admin",
    });
    if (profileError) throw profileError;

    const { data: login, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (loginError || !login.session) throw loginError ?? new Error("無法建立登入工作階段。");

    const response = NextResponse.json({ ok: true }, { status: 201 });
    setSessionCookies(response, login.session);
    return response;
  } catch {
    return NextResponse.json({ message: "首次設定無法完成，請確認資料庫 SQL 與設定碼已完成。" }, { status: 500 });
  }
}
