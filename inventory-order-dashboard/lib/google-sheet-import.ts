export type ImportedLiveSaleProduct = {
  name: string;
  country: string;
  category: string;
  subcategory: string;
  specification: string;
  localPrice: number;
  cost: number;
  retailPrice: number;
  note: string;
};

const headerAliases: Record<keyof ImportedLiveSaleProduct, string[]> = {
  name: ["商品名稱", "品名", "名稱"],
  country: ["國家", "採購國家"],
  category: ["商品分類", "商品種類", "分類"],
  subcategory: ["商品子分類", "子分類"],
  specification: ["商品規格", "規格"],
  localPrice: ["當地價格", "當地貨幣成本", "當地成本"],
  cost: ["台幣成本", "最新成本", "成本"],
  retailPrice: ["一般售價", "售價", "單價"],
  note: ["備註", "商品備註"],
};

const normalise = (value: string) =>
  value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase("zh-TW")
    .replace(/[\s　_－-]/g, "");

const cleanText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

function parseAmount(value: string) {
  const numeric = value.replace(/[^\d.-]/g, "");
  if (!numeric || numeric === "." || numeric === "-") return null;
  const amount = Number(numeric);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : null;
}

function inferCountry(campaignName: string) {
  return ["韓國", "日本", "大陸", "台灣"].find((country) =>
    campaignName.includes(country),
  ) ?? "";
}

// Google 試算表匯出 CSV 時會保留雙引號與欄位中的換行，不能直接用 split。
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function googleSheetCsvUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.hostname !== "docs.google.com") {
    throw new Error("請使用 Google 試算表連結。 ");
  }
  const match = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error("找不到 Google 試算表識別碼。 ");
  const gid = url.searchParams.get("gid") || url.hash.match(/gid=(\d+)/)?.[1] || "0";
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}

// 同一檔期可貼上多個工作表網址（每行一個）。每個網址會依自己的 gid 匯出對應分頁。
export function googleSheetCsvUrls(sourceUrls: string) {
  const urls = sourceUrls
    .split(/[\n\r,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (!urls.length) throw new Error("請至少填入一個 Google 試算表連結。 ");
  return urls.map(googleSheetCsvUrl);
}

export function readLiveSaleProductsCsv(csv: string, campaignName: string) {
  const rows = parseCsv(csv);
  if (!rows.length) return { products: [], invalidRows: [] as number[] };
  const headers = rows[0].map(normalise);
  const column = (field: keyof ImportedLiveSaleProduct) =>
    headers.findIndex((header) => headerAliases[field].map(normalise).includes(header));
  const index = {
    name: column("name"),
    country: column("country"),
    category: column("category"),
    subcategory: column("subcategory"),
    specification: column("specification"),
    localPrice: column("localPrice"),
    cost: column("cost"),
    retailPrice: column("retailPrice"),
    note: column("note"),
  };
  if ([index.name, index.localPrice, index.cost, index.retailPrice].some((value) => value < 0)) {
    throw new Error("試算表第一列需包含：商品名稱、當地價格、台幣成本、一般售價。 ");
  }
  const countryFallback = inferCountry(campaignName);
  const products: ImportedLiveSaleProduct[] = [];
  const invalidRows: number[] = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const value = (field: keyof typeof index) => index[field] >= 0 ? cleanText(row[index[field]]) : "";
    const name = value("name");
    if (!name && !row.some((cell) => cell.trim())) continue;
    const localPrice = parseAmount(value("localPrice"));
    const cost = parseAmount(value("cost"));
    const retailPrice = parseAmount(value("retailPrice"));
    const country = value("country") || countryFallback;
    if (!name || !country || localPrice === null || cost === null || retailPrice === null) {
      invalidRows.push(rowIndex + 1);
      continue;
    }
    products.push({
      name,
      country,
      category: value("category"),
      subcategory: value("subcategory"),
      specification: value("specification"),
      localPrice,
      cost,
      retailPrice,
      note: value("note"),
    });
  }
  return { products, invalidRows };
}

export const liveProductDuplicateKey = (name: string, specification: string) =>
  `${normalise(name)}::${normalise(specification)}`;
