/*詳細
 * wobuy174＿Google Sheet 同步端
 *
 * 1. 將這個檔案完整貼到 Google Apps Script。
 * 2. 將 SPREADSHEET_ID 改成同步試算表網址中的 ID。
 * 3. 在 Apps Script 的「專案設定 → 指令碼屬性」新增 SYNC_SECRET。
 * 4. 部署成 Web App 後，把網址填入 Vercel 的 GOOGLE_SHEETS_WEBHOOK_URL。
 */

const SPREADSHEET_ID = "1vbfQh7j7ZS1WXMakS5hn9e7QTsjdfuUXmlYxjQLFgr8";

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData && event.postData.contents ? event.postData.contents : "{}");
    const expectedSecret = PropertiesService.getScriptProperties().getProperty("SYNC_SECRET");
    if (!expectedSecret || payload.secret !== expectedSecret) return respond_({ ok: false, message: "同步驗證失敗。" });

    if (payload.entity === "product") {
      upsertProduct_(payload);
      appendSyncLog_("商品", payload.action || "upsert", payload.sourceId, "成功", "商品已同步");
      return respond_({ ok: true });
    }

    return respond_({ ok: false, message: "尚未支援的同步資料類型。" });
  } catch (error) {
    return respond_({ ok: false, message: error && error.message ? error.message : "同步失敗。" });
  }
}

function upsertProduct_(payload) {
  const product = payload.record || {};
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("商品");
  if (!sheet) throw new Error("找不到『商品』分頁。");

  const row = findRowBySourceId_(sheet, payload.sourceId);
  const values = [[
    payload.sourceId,
    product.sku || "",
    product.name || "",
    product.country || "",
    product.category || "",
    product.specification || "",
    Number(product.cost || 0),
    Number(product.staff_price || 0),
    Number(product.retail_price || 0),
    Number(product.available_stock || 0),
    Number(product.reserved_stock || 0),
    Number(product.incoming_stock || 0),
    Number(product.safety_stock || 0),
    product.created_at ? new Date(product.created_at) : "",
    new Date(),
  ]];
  const targetRow = row || Math.max(sheet.getLastRow() + 1, 4);
  sheet.getRange(targetRow, 1, 1, values[0].length).setValues(values);
  sheet.getRange(targetRow, 7, 1, 7).setNumberFormat("#,##0");
  sheet.getRange(targetRow, 14, 1, 2).setNumberFormat("yyyy-mm-dd hh:mm");
}

function findRowBySourceId_(sheet, sourceId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return null;
  const ids = sheet.getRange(4, 1, lastRow - 3, 1).getValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (ids[index][0] === sourceId) return index + 4;
  }
  return null;
}

function appendSyncLog_(entity, action, sourceId, status, message) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("同步記錄");
  if (!sheet) return;
  const targetRow = Math.max(sheet.getLastRow() + 1, 4);
  sheet.getRange(targetRow, 1, 1, 6).setValues([[new Date(), entity, action, sourceId, status, message]]);
  sheet.getRange(targetRow, 1).setNumberFormat("yyyy-mm-dd hh:mm");
}

function respond_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
