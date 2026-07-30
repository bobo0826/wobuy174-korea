import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, withRefreshedSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext(request);
    if (!context) return NextResponse.json({ message: "尚未登入。" }, { status: 401 });
    return withRefreshedSession(NextResponse.json({ user: context.profile }), context);
  } catch {
    return NextResponse.json({ message: "帳號權限尚未設定，請先執行最新資料庫 SQL。" }, { status: 503 });
  }
}
