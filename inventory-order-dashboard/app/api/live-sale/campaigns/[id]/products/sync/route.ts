import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import {
  googleSheetCsvUrl,
  liveProductDuplicateKey,
  readLiveSaleProductsCsv,
} from "@/lib/google-sheet-import";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireSignedIn(request);
    if (!auth.context) return auth.response!;
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "連線檔期資料不正確。" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data: campaign, error: campaignError } = await supabase
      .from("live_sale_campaigns")
      .select("id, name, status, source_spreadsheet_url")
      .eq("id", id)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) return NextResponse.json({ message: "找不到連線檔期。" }, { status: 404 });
    if (campaign.status === "已封存") return NextResponse.json({ message: "已封存檔期僅供查看，不能同步商品。" }, { status: 409 });
    if (!campaign.source_spreadsheet_url) return NextResponse.json({ message: "請先在檔期設定填入 Google 試算表連結。" }, { status: 400 });

    const response = await fetch(googleSheetCsvUrl(campaign.source_spreadsheet_url), {
      redirect: "follow",
      headers: { "User-Agent": "wobuy174-inventory-import/1.0" },
    });
    const csv = await response.text();
    if (!response.ok || /<!doctype html|<html/i.test(csv.slice(0, 300))) {
      return NextResponse.json({ message: "無法讀取試算表。請確認已設為「知道連結的人可檢視」。" }, { status: 422 });
    }
    const { products, invalidRows } = readLiveSaleProductsCsv(csv, campaign.name);
    const { data: existing, error: existingError } = await supabase
      .from("live_sale_products")
      .select("name, specification")
      .eq("campaign_id", id);
    if (existingError) throw existingError;
    const knownKeys = new Set((existing ?? []).map((product) => liveProductDuplicateKey(product.name, product.specification)));
    const unseen = products.filter((product) => {
      const key = liveProductDuplicateKey(product.name, product.specification);
      if (knownKeys.has(key)) return false;
      knownKeys.add(key);
      return true;
    });
    let importedCount = 0;
    if (unseen.length) {
      const { data: inserted, error: insertError } = await supabase
        .from("live_sale_products")
        .upsert(unseen.map((product) => ({
          campaign_id: id,
          name: product.name,
          country: product.country,
          category: product.category,
          subcategory: product.subcategory,
          specification: product.specification,
          local_price: product.localPrice,
          cost: product.cost,
          retail_price: product.retailPrice,
          note: product.note,
          created_by: auth.context.profile.displayName,
          updated_at: new Date().toISOString(),
        })), { onConflict: "campaign_id,name,specification", ignoreDuplicates: true })
        .select("id");
      if (insertError) throw insertError;
      importedCount = inserted?.length ?? 0;
    }
    return withRefreshedSession(NextResponse.json({
      importedCount,
      skippedDuplicateCount: products.length - importedCount,
      skippedInvalidRows: invalidRows,
    }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法同步 Google 試算表商品。") }, { status: 500 });
  }
}
