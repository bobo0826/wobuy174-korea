import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase.from("products").select("id", { count: "exact", head: true });

    if (error) throw error;

    return NextResponse.json({ connected: true, productCount: count ?? 0 });
  } catch (error) {
    return NextResponse.json(
      { connected: false, message: error instanceof Error ? error.message : "無法連線資料庫。" },
      { status: 503 },
    );
  }
}
