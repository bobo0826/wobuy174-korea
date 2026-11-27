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

    if (payload.entity === "liveSaleProduct") {
      upsertLiveSaleProduct_(payload);
      return respond_({ ok: true });
    }

    return respond_({ ok: false, message: "尚未支援的同步資料類型。" });
  } catch (error) {
    return respond_({ ok: false, message: error && error.message ? error.message : "同步失敗。" });
  }
}

function upsertLiveSaleProduct_(payload) {
  const spreadsheetId = String(payload.spreadsheetId || "").trim();
  if (!spreadsheetId) throw new Error("缺少檔期試算表 ID。");

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheetName = String(payload.sheetName || "系統新增商品");
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, 13).setValues([["系統商品 ID", "檔期編號", "商品名稱", "國家", "商品分類", "商品子分類", "商品規格", "當地價格", "台幣成本", "一般售價", "備註", "建立時間", "更新時間"]]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 13).setFontWeight("bold").setFontStyle("italic").setBackground("#f3f3f3");
  }

  const row = findRowBySourceIdFromRow_(sheet, payload.sourceId, 2);
  // 修改從試算表匯入的商品時，不會把它們複製進這個系統新增分頁。
  if (!row && payload.action === "update") return;

  const product = payload.record || {};
  const values = [[
    payload.sourceId || "",
    payload.campaignCode || "",
    product.name || "",
    product.country || "",
    product.category || "",
    product.subcategory || "",
    product.specification || "",
    Number(product.local_price || 0),
    Number(product.cost || 0),
    Number(product.retail_price || 0),
    product.note || "",
    product.created_at ? new Date(product.created_at) : new Date(),
    new Date(),
  ]];
  const targetRow = row || Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(targetRow, 1, 1, values[0].length).setValues(values);
  sheet.getRange(targetRow, 8, 1, 3).setNumberFormat("#,##0");
  sheet.getRange(targetRow, 12, 1, 2).setNumberFormat("yyyy/mm/dd hh:mm");
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
  return findRowBySourceIdFromRow_(sheet, sourceId, 4);
}

function findRowBySourceIdFromRow_(sheet, sourceId, firstDataRow) {
  const lastRow = sheet.getLastRow();
  if (lastRow < firstDataRow) return null;
  const ids = sheet.getRange(firstDataRow, 1, lastRow - firstDataRow + 1, 1).getValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (ids[index][0] === sourceId) return index + firstDataRow;
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
