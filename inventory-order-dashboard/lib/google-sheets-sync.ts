import { googleSheetSpreadsheetId } from "@/lib/google-sheet-import";

export type GoogleSheetSyncResult =
  | { status: "disabled" }
  | { status: "synced" }
  | { status: "failed"; message: string };

type ProductRecord = {
  id: string;
  sku: string;
  name: string;
  country: string;
  category: string;
  subcategory: string;
  specification: string;
  note: string;
  cost: number;
  local_price: number;
  staff_price: number;
  retail_price: number;
  available_stock: number;
  reserved_stock: number;
  incoming_stock: number;
  safety_stock: number;
  created_at: string;
};

export async function syncProductToGoogleSheet(product: ProductRecord): Promise<GoogleSheetSyncResult> {
  return postToGoogleSheet({
    entity: "product",
    action: "upsert",
    sourceId: product.id,
    record: product,
  });
}

export type LiveSaleProductSheetRecord = {
  id: string;
  name: string;
  country: string;
  category: string;
  subcategory: string;
  specification: string;
  local_price: number;
  cost: number;
  retail_price: number;
  note: string;
  created_at: string;
  updated_at: string;
};

export async function syncLiveSaleProductToGoogleSheet({
  product,
  campaignCode,
  sourceSpreadsheetUrl,
  action,
}: {
  product: LiveSaleProductSheetRecord;
  campaignCode: string;
  sourceSpreadsheetUrl: string;
  action: "create" | "update";
}): Promise<GoogleSheetSyncResult> {
  try {
    const firstSourceUrl = sourceSpreadsheetUrl.split(/[\n\r,]+/).map((value) => value.trim()).find(Boolean);
    if (!firstSourceUrl) return { status: "disabled" };
    return await postToGoogleSheet({
      entity: "liveSaleProduct",
      action,
      sourceId: product.id,
      spreadsheetId: googleSheetSpreadsheetId(firstSourceUrl),
      sheetName: "系統新增商品",
      campaignCode,
      record: product,
    });
  } catch (error) {
    return { status: "failed", message: error instanceof Error ? error.message : "檔期商品試算表設定不正確。" };
  }
}

async function postToGoogleSheet(payload: Record<string, unknown>): Promise<GoogleSheetSyncResult> {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const webhookSecret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) return { status: "disabled" };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        secret: webhookSecret,
        ...payload,
      }),
      cache: "no-store",
    });

    const result = await response.json().catch(() => null) as { ok?: boolean; message?: string } | null;
    if (!response.ok || !result?.ok) {
      return { status: "failed", message: result?.message ?? "Google 試算表未接受同步資料。" };
    }
    return { status: "synced" };
  } catch {
    return { status: "failed", message: "暫時無法連接 Google 試算表。" };
  }
}
