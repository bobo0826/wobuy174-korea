/**
 * 信男代購 Google 試算表 → 網站商品同步
 *
 * 使用方式：在 Google 試算表選擇「擴充功能 > Apps Script」，貼上本檔內容。
 * 請先將下方兩個設定換成你的正式值，再執行 installEditTrigger 一次。
 */

const CONFIG = Object.freeze({
  SHEET_NAME: "工作表1",
  HEADER_ROW: 1,
  WEBHOOK_URL: "https://YOUR-VERCEL-DOMAIN.vercel.app/api/google-sheets-sync",
  SYNC_SECRET: "PASTE_THE_SAME_SECRET_AS_VERCEL",
});

const REQUIRED_COLUMNS = ["商品編號", "品名", "優惠價"];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("信男代購同步")
    .addItem("同步全部商品", "syncAllProducts")
    .addItem("安裝／重設自動同步", "installEditTrigger")
    .addToUi();
}

/**
 * 第一次設定時手動執行這個函式，Google 會要求授權。
 * 它會建立「試算表編輯時」的安裝型觸發器。
 */
function installEditTrigger() {
  const spreadsheet = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "syncEditedRows")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("syncEditedRows")
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert("已啟用自動同步。之後每次編輯商品列都會更新網站。");
}

/**
 * 安裝型觸發器使用：偵測一列或多列商品的編輯。
 */
function syncEditedRows(event) {
  if (!event || !event.range) return;

  const range = event.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME || range.getLastRow() <= CONFIG.HEADER_ROW) return;

  const startRow = Math.max(range.getRow(), CONFIG.HEADER_ROW + 1);
  const products = [];
  for (let rowNumber = startRow; rowNumber <= range.getLastRow(); rowNumber += 1) {
    const product = readProductRow_(sheet, rowNumber);
    if (isReadyToSync_(product)) products.push(product);
  }

  if (products.length) postProducts_(products);
}

/**
 * 可從自訂選單手動執行，適合第一次將整張工作表同步到網站。
 */
function syncAllProducts() {
  const sheet = getTargetSheet_();
  const lastRow = sheet.getLastRow();
  const products = [];

  for (let rowNumber = CONFIG.HEADER_ROW + 1; rowNumber <= lastRow; rowNumber += 1) {
    const product = readProductRow_(sheet, rowNumber);
    if (isReadyToSync_(product)) products.push(product);
  }

  if (!products.length) {
    SpreadsheetApp.getUi().alert("目前沒有可同步的商品；請確認商品編號、品名、優惠價皆已填寫。");
    return;
  }

  const result = postProducts_(products);
  SpreadsheetApp.getUi().alert(`已同步 ${result.synced} 件商品到網站。`);
}

function getTargetSheet_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error(`找不到工作表「${CONFIG.SHEET_NAME}」。`);
  return sheet;
}

function readProductRow_(sheet, rowNumber) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, lastColumn).getDisplayValues()[0];
  const values = sheet.getRange(rowNumber, 1, 1, lastColumn).getDisplayValues()[0];

  return headers.reduce((product, header, index) => {
    const key = String(header).trim();
    if (key) product[key] = String(values[index] || "").trim();
    return product;
  }, {});
}

function isReadyToSync_(product) {
  return REQUIRED_COLUMNS.every((column) => Boolean(product[column]));
}

function postProducts_(products) {
  const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    headers: { "x-sync-secret": CONFIG.SYNC_SECRET },
    payload: JSON.stringify({ products }),
    muteHttpExceptions: true,
  });

  const body = response.getContentText();
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(`同步失敗（${response.getResponseCode()}）：${body}`);
  }

  return JSON.parse(body);
}
