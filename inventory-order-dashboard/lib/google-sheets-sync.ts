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
  specification: string;
  cost: number;
  staff_price: number;
  retail_price: number;
  available_stock: number;
  reserved_stock: number;
  incoming_stock: number;
  safety_stock: number;
  created_at: string;
};

export async function syncProductToGoogleSheet(product: ProductRecord): Promise<GoogleSheetSyncResult> {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const webhookSecret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) return { status: "disabled" };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        secret: webhookSecret,
        entity: "product",
        action: "upsert",
        sourceId: product.id,
        record: product,
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
