import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "商品資料不正確。" }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().from("product_change_logs").select("id, change_note, changed_by, changes, created_at").eq("product_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return withRefreshedSession(NextResponse.json({ history: data ?? [] }), auth.context);
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
    const setupRequired = (typeof error === "object" && error !== null && (error as { code?: string }).code === "PGRST205") || /product_change_logs/i.test(message) && /(schema cache|does not exist|could not find)/i.test(message);
    return NextResponse.json({ message: setupRequired ? "商品異動紀錄資料庫尚未建立。" : message || "無法讀取商品異動紀錄。", setupRequired }, { status: 503 });
  }
}
