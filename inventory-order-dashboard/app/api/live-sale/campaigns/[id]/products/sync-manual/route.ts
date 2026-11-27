import { NextRequest, NextResponse } from "next/server";
import { requireSignedIn, withRefreshedSession } from "@/lib/auth";
import {
  googleSheetCsvUrls,
  liveProductDuplicateKey,
  readLiveSaleProductsCsv,
} from "@/lib/google-sheet-import";
import { syncLiveSaleProductToGoogleSheet } from "@/lib/google-sheets-sync";
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
      .select("id, name, campaign_code, status, source_spreadsheet_url")
      .eq("id", id)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) return NextResponse.json({ message: "找不到連線檔期。" }, { status: 404 });
    if (campaign.status === "已封存") return NextResponse.json({ message: "已封存檔期僅供查看，不能同步商品。" }, { status: 409 });
    if (!campaign.source_spreadsheet_url) return NextResponse.json({ message: "請先在檔期設定填入 Google 試算表連結。" }, { status: 400 });

    const sourceProducts = (await Promise.all(
      googleSheetCsvUrls(campaign.source_spreadsheet_url).map(async (url, index) => {
        const response = await fetch(url, { redirect: "follow", headers: { "User-Agent": "wobuy174-inventory-import/1.0" } });
        const csv = await response.text();
        if (!response.ok || /<!doctype html|<html/i.test(csv.slice(0, 300))) {
          throw new Error(`無法讀取第 ${index + 1} 個工作表。請確認已設為「知道連結的人可檢視」。`);
        }
        return readLiveSaleProductsCsv(csv, campaign.name).products;
      }),
    )).flat();
    const spreadsheetKeys = new Set(sourceProducts.map((product) => liveProductDuplicateKey(product.name, product.specification)));

    const { data: products, error: productsError } = await supabase
      .from("live_sale_products")
      .select("id, name, country, category, subcategory, specification, local_price, cost, retail_price, note, created_at, updated_at")
      .eq("campaign_id", id)
      .order("created_at", { ascending: true });
    if (productsError) throw productsError;

    const manualProducts = (products ?? []).filter((product) => !spreadsheetKeys.has(liveProductDuplicateKey(product.name, product.specification)));
    let syncedCount = 0;
    let disabled = false;
    const failed: string[] = [];
    for (const product of manualProducts) {
      const result = await syncLiveSaleProductToGoogleSheet({
        product,
        campaignCode: campaign.campaign_code,
        sourceSpreadsheetUrl: campaign.source_spreadsheet_url,
        action: "create",
      });
      if (result.status === "synced") syncedCount += 1;
      if (result.status === "disabled") disabled = true;
      if (result.status === "failed") failed.push(result.message);
    }
    if (disabled) return NextResponse.json({ message: "尚未設定 Google 試算表自動同步。" }, { status: 503 });
    if (failed.length) return NextResponse.json({ message: failed[0] }, { status: 502 });

    return withRefreshedSession(NextResponse.json({
      syncedCount,
      skippedSpreadsheetCount: (products?.length ?? 0) - manualProducts.length,
    }), auth.context);
  } catch (error) {
    return NextResponse.json({ message: errorMessage(error, "無法回寫系統新增的檔期商品。") }, { status: 500 });
  }
}
