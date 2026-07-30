import { NextRequest, NextResponse } from "next/server";
import { setSessionCookies } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return NextResponse.json({ message: "請輸入 Email 與密碼。" }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin().auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session) {
      return NextResponse.json({ message: "Email 或密碼不正確。" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    setSessionCookies(response, data.session);
    return response;
  } catch {
    return NextResponse.json({ message: "登入暫時無法完成，請稍後再試。" }, { status: 500 });
  }
}
