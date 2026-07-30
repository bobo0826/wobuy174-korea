"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Dashboard } from "./dashboard-summary";
import { Orders } from "./orders-page";

type View =
  | "dashboard"
  | "orders"
  | "products"
  | "product"
  | "inventory"
  | "stock"
  | "purchases"
  | "reports"
  | "settings"
  | "customers"
  | "suppliers"
  | "create"
  | "newProduct"
  | "importProducts"
  | "newPurchase";
type Tone = "green" | "orange" | "blue" | "stone";

type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "staff";
};

type ManagedUser = {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "staff";
  created_at: string;
};

type Product = {
  id: number | string;
  name: string;
  country: string;
  category: string;
  specification: string;
  sku: string;
  cost: number;
  staffPrice: number;
  retailPrice: number;
  available: number;
  reserved: number;
  incoming: number;
  safety: number;
  tone: string;
  supplierId?: string | null;
  supplierName?: string;
};

type StoredProduct = {
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
  supplier_id: string | null;
  suppliers?: { name: string } | null;
};

type Customer = {
  id: string;
  name: string;
  line_name: string;
  phone: string;
  address: string;
  created_at: string;
  updated_at: string;
};

type Supplier = {
  id: string;
  name: string;
  country: string;
  transaction_method: string;
  moq: string;
  payment_method: "現金" | "轉帳" | "信用卡";
  created_at: string;
  updated_at: string;
};

type PurchaseOrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  unit_cost: number;
  quantity: number;
  received_quantity: number;
};

type PurchaseOrder = {
  id: string;
  purchase_number: string;
  supplier_id: string | null;
  supplier_name: string;
  expected_arrival_date: string | null;
  payment_terms: string;
  status: "草稿" | "已送出" | "部分收貨" | "待收貨" | "已完成" | "已取消";
  total: number;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  purchase_order_items: PurchaseOrderItem[];
};

type InventoryAdjustment = {
  id: string;
  product_id: string;
  quantity_change: number;
  reason: string;
  note: string;
  performed_by: string;
  created_at: string;
  products: { name: string; sku: string } | null;
};

const products: Array<Product & { id: number }> = [
  { id: 1, name: "雲朵感純棉四季被", country: "韓國", category: "棉被", specification: "奶油白／單人", sku: "KB-174-CR", cost: 880, staffPrice: 1280, retailPrice: 1680, available: 32, reserved: 6, incoming: 48, safety: 12, tone: "#E9E1D5" },
  { id: 2, name: "霧面日常隨行杯", country: "日本", category: "3COIN", specification: "淺灰／500ml", sku: "JP-042-GR", cost: 290, staffPrice: 450, retailPrice: 590, available: 8, reserved: 4, incoming: 0, safety: 10, tone: "#DFE4E0" },
  { id: 3, name: "刺繡小熊收納化妝包", country: "韓國", category: "美妝", specification: "燕麥／小尺寸", sku: "KR-108-OT", cost: 180, staffPrice: 320, retailPrice: 420, available: 24, reserved: 3, incoming: 30, safety: 8, tone: "#EADAD0" },
  { id: 4, name: "韓國蝴蝶結棉襪組", country: "韓國", category: "潮牌", specification: "粉霧／兩雙入", sku: "KR-330-PK", cost: 138, staffPrice: 250, retailPrice: 330, available: 57, reserved: 9, incoming: 0, safety: 20, tone: "#E6DCE3" },
  { id: 5, name: "透明桌面收納盒", country: "日本", category: "3COIN", specification: "中尺寸", sku: "JP-152-MD", cost: 270, staffPrice: 430, retailPrice: 560, available: 17, reserved: 2, incoming: 24, safety: 8, tone: "#DCE4E8" },
];

const productTones = ["#E9E1D5", "#DFE4E0", "#EADAD0", "#E6DCE3", "#DCE4E8"];
const toProduct = (record: StoredProduct): Product => ({
  id: record.id,
  name: record.name,
  country: record.country,
  category: record.category,
  specification: record.specification,
  sku: record.sku,
  cost: record.cost,
  staffPrice: record.staff_price,
  retailPrice: record.retail_price,
  available: record.available_stock,
  reserved: record.reserved_stock,
  incoming: record.incoming_stock,
  safety: record.safety_stock,
  tone: productTones[record.name.length % productTones.length],
  supplierId: record.supplier_id,
  supplierName: record.suppliers?.name ?? "",
});

const productCategoriesByCountry: Record<string, string[]> = {
  "韓國": ["棉被", "美妝", "藥局", "潮牌", "專櫃", "食品", "文創", "大創", "娃娃", "批發", "其他"],
  "日本": ["3COIN", "藥妝", "三麗鷗", "吉伊卡哇", "專櫃", "其他"],
  "大陸": ["其他"],
  "台灣": ["其他"],
  "其他": ["其他"],
};

const nav: { id: Exclude<View, "create" | "product">; label: string; no: string }[] = [
  { id: "dashboard", label: "營運總覽", no: "01" },
  { id: "orders", label: "訂單管理", no: "02" },
  { id: "customers", label: "客戶管理", no: "03" },
  { id: "products", label: "商品資料庫", no: "04" },
  { id: "inventory", label: "庫存管理", no: "05" },
  { id: "stock", label: "庫存總覽", no: "06" },
  { id: "purchases", label: "採購與供應商", no: "07" },
  { id: "reports", label: "報表中心", no: "08" },
  { id: "settings", label: "系統設定", no: "09" },
];

const currency = (value: number) => `NT$ ${value.toLocaleString("zh-TW")}`;
const taipeiToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const firstOrderNumberForDate = (date: string) => `${date.replaceAll("-", "")}001`;
const buttonClass = "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#292824]";
const statusClass: Record<Tone, string> = { green: "bg-[#E7F0E8] text-[#477154]", orange: "bg-[#FAECDD] text-[#A66932]", blue: "bg-[#E5EEF2] text-[#4B6D79]", stone: "bg-[#F3F1ED] text-[#68645C]" };

function Primary({ children, onClick, className = "", disabled = false, type = "button" }: { children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean; type?: "button" | "submit" }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`${buttonClass} bg-[#292824] text-white hover:bg-[#46423D] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}>{children}</button>;
}

function Secondary({ children, onClick, className = "", disabled = false, type = "button" }: { children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean; type?: "button" | "submit" }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`${buttonClass} border border-[#E5E1DB] bg-white text-[#58544D] hover:bg-[#FCFBF9] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}>{children}</button>;
}

function Pill({ children, tone = "stone" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass[tone]}`}>{children}</span>;
}

function ProductTile({ product, small = false }: { product: Product; small?: boolean }) {
  return <span aria-hidden="true" style={{ backgroundColor: product.tone }} className={`flex shrink-0 items-center justify-center rounded-xl p-1 text-[10px] font-black tracking-[.12em] text-[#6A6157] ${small ? "h-9 w-9" : "h-11 w-11"}`}>{product.category.slice(0, 2)}</span>;
}

function Header({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold tracking-[.18em] text-[#A09A90]">{eyebrow}</p><h1 className="mt-2 text-[29px] font-semibold tracking-[-.055em] text-[#292824] sm:text-[33px]">{title}</h1><p className="mt-2 text-sm leading-6 text-[#7B766E]">{description}</p></div>{children && <div className="flex flex-wrap gap-2">{children}</div>}</div>;
}

function Metric({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return <div className={`rounded-2xl border p-5 ${accent ? "border-[#D9E4DE] bg-[#EEF4EF]" : "border-[#E9E5DF] bg-white"}`}><p className="text-xs font-semibold tracking-wide text-[#807A72]">{label}</p><p className="mt-4 text-2xl font-semibold tracking-[-.05em] text-[#292824]">{value}</p><p className="mt-2 text-xs text-[#8B847A]">{note}</p></div>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#E9E5DF] bg-white ${className}`}>{children}</section>;
}

function Search({ placeholder = "搜尋商品、SKU、條碼或訂單", value, onChange }: { placeholder?: string; value?: string; onChange?: (value: string) => void }) {
  return <label className="flex h-11 max-w-md flex-1 items-center gap-2 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#928C84]"><span>⌕</span><input value={value} onChange={(event) => onChange?.(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#AAA39A]" placeholder={placeholder} /></label>;
}

function LegacyDashboard({ go }: { go: (view: View) => void }) {
  const bars = [42, 65, 50, 76, 58, 92, 84];
  return <>
    <Header eyebrow="21 JULY 2026" title="營運總覽" description="早安，怡文。今天的訂單與庫存狀態都整理在這裡。"><Secondary onClick={() => go("stock")}>查看庫存總覽</Secondary><Primary onClick={() => go("create")}>＋ 建立訂單</Primary></Header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="今日已確認訂單" value="18 筆" note="較昨日 + 12.5%" accent /><Metric label="待處理訂單" value="06 筆" note="3 筆待確認，3 筆備貨中" /><Metric label="低庫存品項" value="04 項" note="立即查看補貨建議" /><Metric label="可售庫存總值" value="NT$ 186,400" note="以目前可售庫存估算" /></section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,.8fr)]"><Card className="p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="font-semibold text-[#292824]">訂單趨勢</h2><p className="mt-1 text-sm text-[#898379]">近 7 日已確認訂單</p></div><Pill>7 月 15 日 — 21 日</Pill></div><div className="mt-8 flex h-48 items-end justify-between gap-2 sm:gap-4">{bars.map((height, i) => <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className={`w-full max-w-9 rounded-t-lg ${i === 6 ? "bg-[#738C7A]" : "bg-[#DDE7DF]"}`} style={{ height: `${height}%` }} /><small className="text-[10px] text-[#9B958C]">{15 + i}</small></div>)}</div><div className="mt-4 flex justify-between border-t border-[#F0EDE8] pt-4 text-xs text-[#7A756E]"><span>本週訂單</span><strong className="text-[#3F5F48]">124 筆 · +18.4%</strong></div></Card><Card className="p-5 sm:p-6"><div className="flex justify-between"><div><h2 className="font-semibold text-[#292824]">待處理事項</h2><p className="mt-1 text-sm text-[#898379]">今天優先完成的工作</p></div><button onClick={() => go("orders")} className="text-sm font-semibold text-[#5E7665]">查看全部</button></div><div className="mt-4 divide-y divide-[#F0EDE8]">{[["03", "筆訂單待確認", "確認後將立即扣除可售庫存", "orders"], ["04", "項商品庫存不足", "建議建立採購單補貨", "stock"], ["02", "張採購單待收貨", "預計今天到貨", "purchases"]].map(([number, title, note, target]) => <button key={title} onClick={() => go(target as View)} className="flex w-full items-center gap-3 py-4 text-left"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F1EC] text-xs font-bold text-[#625D55]">{number}</span><span className="min-w-0 flex-1"><b className="block text-sm text-[#48443E]">{title}</b><small className="block pt-1 text-xs text-[#958F86]">{note}</small></span><span className="text-[#AAA39A]">→</span></button>)}</div></Card></section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,.8fr)]"><Card className="overflow-hidden"><div className="flex items-center justify-between px-5 py-5 sm:px-6"><div><h2 className="font-semibold text-[#292824]">近期訂單</h2><p className="mt-1 text-sm text-[#898379]">最新建立與處理中的訂單</p></div><button onClick={() => go("orders")} className="text-sm font-semibold text-[#5E7665]">訂單管理 →</button></div><div className="overflow-x-auto"><table className="w-full min-w-[590px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">訂單編號</th><th className="px-3 py-3">客戶</th><th className="px-3 py-3">金額</th><th className="px-3 py-3">狀態</th><th className="px-6 py-3 text-right">時間</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{[["#WB-260721-018", "林小安", "NT$ 2,520", "已確認", "green", "10:42"], ["#WB-260721-017", "陳語彤", "NT$ 1,180", "待確認", "orange", "10:18"], ["#WB-260721-016", "許惠晴", "NT$ 3,360", "備貨中", "blue", "09:56"]].map(([id, person, amount, status, tone, time]) => <tr key={id}><td className="px-6 py-4 font-semibold text-[#4A4640]">{id}</td><td className="px-3 py-4 text-[#6F6960]">{person}</td><td className="px-3 py-4 font-medium">{amount}</td><td className="px-3 py-4"><Pill tone={tone as Tone}>{status}</Pill></td><td className="px-6 py-4 text-right text-[#8D877E]">{time}</td></tr>)}</tbody></table></div></Card><Card className="p-5 sm:p-6"><div className="flex justify-between"><div><h2 className="font-semibold text-[#292824]">低庫存提醒</h2><p className="mt-1 text-sm text-[#898379]">低於安全庫存的商品</p></div><button onClick={() => go("stock")} className="text-sm font-semibold text-[#5E7665]">總覽 →</button></div><div className="mt-5 space-y-4">{products.slice(1, 4).map((product, i) => <div key={product.id} className="flex items-center gap-3"><ProductTile product={product} small /><div className="min-w-0 flex-1"><b className="block truncate text-sm text-[#4C4842]">{product.name}</b><small className="block pt-1 text-xs text-[#969087]">可售 {i === 0 ? 8 : i === 1 ? 6 : 10} · 安全庫存 {product.safety}</small></div><Pill tone="orange">需補貨</Pill></div>)}</div></Card></section>
  </>;
}

function LegacyOrders({ created, go }: { created: boolean; go: (view: View) => void }) {
  const rows = [ ...(created ? [["#WB-260721-019", "王思妤", "3 項", "NT$ 2,430", "已確認", "green", "剛剛"]] : []), ["#WB-260721-018", "林小安", "4 項", "NT$ 2,520", "已確認", "green", "10:42"], ["#WB-260721-017", "陳語彤", "2 項", "NT$ 1,180", "待確認", "orange", "10:18"], ["#WB-260721-016", "許惠晴", "5 項", "NT$ 3,360", "備貨中", "blue", "09:56"] ];
  return <><Header eyebrow="ORDERS" title="訂單管理" description="集中處理訂單確認、備貨、出貨與取消作業。"><Primary onClick={() => go("create")}>＋ 建立訂單</Primary></Header><Card className="overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#F0EDE8] p-5 sm:p-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><Search placeholder="搜尋訂單編號、客戶姓名或商品" /><span className="text-xs text-[#807A71]">共 28 筆訂單</span></div><div className="flex gap-2 overflow-x-auto">{["全部狀態", "草稿", "待確認", "已確認", "備貨中", "已出庫", "已取消"].map((status, i) => <button key={status} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${i === 0 ? "bg-[#292824] text-white" : "bg-[#F4F1ED] text-[#706A61]"}`}>{status}</button>)}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[825px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">訂單編號</th><th className="px-3 py-3">建立日期</th><th className="px-3 py-3">客戶</th><th className="px-3 py-3">商品</th><th className="px-3 py-3">金額</th><th className="px-3 py-3">付款</th><th className="px-3 py-3">訂單狀態</th><th className="px-6 py-3">庫存狀態</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{rows.map(([id, person, item, amount, status, tone, time]) => <tr key={id} className="hover:bg-[#FCFBF9]"><td className="px-6 py-4 font-semibold text-[#4A4640]">{id}</td><td className="px-3 py-4 text-[#777168]">07.21 {time}</td><td className="px-3 py-4 text-[#5C574F]">{person}</td><td className="px-3 py-4">{item}</td><td className="px-3 py-4 font-medium">{amount}</td><td className="px-3 py-4"><Pill tone="green">已付款</Pill></td><td className="px-3 py-4"><Pill tone={tone as Tone}>{status}</Pill></td><td className="px-6 py-4"><Pill tone={status === "待確認" ? "stone" : "green"}>{status === "待確認" ? "尚未扣除" : "庫存已保留"}</Pill></td></tr>)}</tbody></table></div></Card></>;
}

function Products({ catalog, openProduct, openNewProduct, openImportProducts, deleteProduct }: { catalog: Product[]; openProduct: (product: Product) => void; openNewProduct: () => void; openImportProducts: () => void; deleteProduct: (product: Product) => Promise<void> }) {
  const [countryFilter, setCountryFilter] = useState("全部國家");
  const [categoryFilter, setCategoryFilter] = useState("全部商品種類");
  const [statusFilter, setStatusFilter] = useState("全部狀態");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const countries = Object.keys(productCategoriesByCountry);
  const categoryOptions = countryFilter === "全部國家" ? Array.from(new Set(catalog.map((product) => product.category))) : productCategoriesByCountry[countryFilter] ?? [];
  const visibleProducts = catalog.filter((product) => {
    const isLowStock = product.available <= product.safety;
    const matchesQuery = !query.trim() || [product.name, product.sku, product.country, product.category, product.specification].join(" ").toLowerCase().includes(query.trim().toLowerCase());
    return (countryFilter === "全部國家" || product.country === countryFilter)
      && (categoryFilter === "全部商品種類" || product.category === categoryFilter)
      && (statusFilter === "全部狀態" || (statusFilter === "低庫存" ? isLowStock : !isLowStock))
      && matchesQuery;
  });
  const selectClass = "h-9 w-full rounded-xl border border-[#E5E1DB] bg-white px-3 text-xs font-semibold text-[#58544D] outline-none";
  const removeProduct = async (product: Product) => {
    if (typeof product.id !== "string") {
      setError("示範商品無法刪除；只有已儲存到資料庫的商品可以刪除。");
      return;
    }
    if (!window.confirm(`確定要刪除「${product.name}」嗎？此動作無法復原。`)) return;
    setDeletingId(product.id);
    setError("");
    setNotice("");
    try {
      await deleteProduct(product);
      setNotice(`「${product.name}」已從商品資料庫刪除。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法刪除商品。");
    } finally {
      setDeletingId("");
    }
  };

  return <>
    <Header eyebrow="PRODUCT CATALOG" title="商品資料庫" description="集中管理商品、規格、價格與庫存設定。"><Secondary onClick={openImportProducts}>匯入商品</Secondary><Primary onClick={openNewProduct}>＋ 新增商品</Primary></Header>
    {notice && <Card className="mb-5 border-[#D9E5DB] bg-[#EEF5EF] p-4 text-sm font-semibold text-[#45634C]">{notice}</Card>}
    {error && <Card className="mb-5 border-[#F0D6C2] bg-[#FFF7F0] p-4 text-sm font-semibold text-[#9B562A]">{error}</Card>}
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#F0EDE8] p-5 sm:p-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><Search value={query} onChange={setQuery} placeholder="搜尋商品名稱、商品編號或條碼" /><span className="text-xs text-[#807A71]">顯示 {visibleProducts.length} 項商品</span></div><div className="grid w-full gap-2 sm:max-w-[497px] sm:grid-cols-3"><select aria-label="國家篩選" value={countryFilter} onChange={(event) => { setCountryFilter(event.target.value); setCategoryFilter("全部商品種類"); }} className={selectClass}><option>全部國家</option>{countries.map((country) => <option key={country}>{country}</option>)}</select><select aria-label="商品種類篩選" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={selectClass}><option>全部商品種類</option>{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select><select aria-label="商品狀態篩選" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={selectClass}><option>全部狀態</option><option>正常庫存</option><option>低庫存</option></select></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[990px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">商品</th><th className="px-3 py-3">商品編號</th><th className="px-3 py-3">種類</th><th className="px-3 py-3">一般售價</th><th className="px-3 py-3">可售庫存</th><th className="px-3 py-3">狀態</th><th className="px-6 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{visibleProducts.length ? visibleProducts.map((product) => <tr key={product.id} className="hover:bg-[#FCFBF9]"><td className="px-6 py-4"><button onClick={() => openProduct(product)} className="flex items-center gap-3 text-left"><ProductTile product={product}/><span><b className="block text-[#4A4640]">{product.name}</b><small className="block pt-1 text-xs text-[#938D84]">{product.specification}</small></span></button></td><td className="px-3 py-4 font-mono text-xs text-[#6E695F]">{product.sku}</td><td className="px-3 py-4 text-[#625D55]">{product.country} · {product.category}</td><td className="px-3 py-4 font-medium">{currency(product.retailPrice)}</td><td className={`px-3 py-4 font-semibold ${product.available <= product.safety ? "text-[#A66932]" : "text-[#476B51]"}`}>{product.available}</td><td className="px-3 py-4"><Pill tone={product.available <= product.safety ? "orange" : "green"}>{product.available <= product.safety ? "低庫存" : "已上架"}</Pill></td><td className="px-6 py-4"><div className="flex items-center justify-end gap-4"><button onClick={() => openProduct(product)} className="text-sm font-semibold text-[#5E7665]">查看商品</button>{typeof product.id === "string" && <button onClick={() => { void removeProduct(product); }} disabled={deletingId === product.id} className="text-sm font-semibold text-[#A35F37] disabled:cursor-not-allowed disabled:opacity-45">{deletingId === product.id ? "刪除中…" : "刪除"}</button>}</div></td></tr>) : <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-[#8D877E]">找不到符合條件的商品。</td></tr>}</tbody></table></div>
    </Card>
  </>;
}

function NewProduct({ back, onCreated }: { back: () => void; onCreated: (product: Product) => void }) {
  const [saved, setSaved] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [form, setForm] = useState({ sku: "", name: "", specification: "", cost: "0", staffPrice: "0", retailPrice: "0", availableStock: "0", safetyStock: "0" });
  const inputClass = "mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none placeholder:text-[#AAA39A]";
  const categoryOptions = productCategoriesByCountry[country] ?? [];
  const updateForm = (field: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [field]: value }));
  useEffect(() => {
    let active = true;
    const loadSuppliers = async () => {
      try {
        const response = await fetch("/api/suppliers");
        const result = await response.json();
        if (response.ok && active) setSuppliers(result.suppliers ?? []);
      } catch {
        // 供應商尚未建立時仍可先新增商品，之後再從商品頁連結。
      }
    };
    void loadSuppliers();
    return () => { active = false; };
  }, []);
  const saveProduct = async () => {
    setSaving(true);
    setSaveError("");
    setSaved(false);
    setSyncNotice("");

    try {
      const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, country, category, supplierId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? result.message ?? "無法儲存商品。");
      if (result.product) onCreated(toProduct(result.product as StoredProduct));
      setSaved(true);
      if (result.sync?.status === "synced") setSyncNotice("商品已同步至 Google 試算表。");
      if (result.sync?.status === "disabled") setSyncNotice("商品已儲存；Google 試算表同步尚未設定。");
      if (result.sync?.status === "failed") setSyncNotice(`商品已儲存；${result.sync.message}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "無法儲存商品。");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <Header eyebrow="NEW PRODUCT" title="新增商品" description="建立商品基本資料、售價與初始庫存。"><Secondary onClick={back}>← 返回商品資料庫</Secondary></Header>
    {saved && <Card className="mb-5 border-[#D9E5DB] bg-[#EEF5EF] p-5"><b className="block text-[#34563D]">商品已建立</b><small className="mt-1 block text-sm text-[#57735D]">商品資料已儲存至商品資料庫。{syncNotice && ` ${syncNotice}`}</small></Card>}
    {saveError && <Card className="mb-5 border-[#F0D6C2] bg-[#FFF7F0] p-5"><b className="block text-[#965723]">商品尚未儲存</b><small className="mt-1 block text-sm text-[#A36B3C]">{saveError}</small></Card>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-5">
        <Card className="p-5 sm:p-6">
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">BASIC INFORMATION</p>
          <h2 className="mt-1 text-lg font-semibold">商品基本資料</h2>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <label className="text-sm font-semibold text-[#58534C]">商品編號<input value={form.sku} onChange={(event) => updateForm("sku", event.target.value)} placeholder="例如：KB-174-CR" className={inputClass} /></label>
            <label className="text-sm font-semibold text-[#58534C]">商品名稱<input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="例如：雲朵感純棉四季被" className={inputClass} /></label>
            <label className="text-sm font-semibold text-[#58534C]">國家<select value={country} onChange={(event) => { setCountry(event.target.value); setCategory(""); }} className={inputClass}><option value="">請選擇國家</option><option>韓國</option><option>日本</option><option>大陸</option><option>台灣</option><option>其他</option></select></label>
            <label className="text-sm font-semibold text-[#58534C]">商品種類<select value={category} onChange={(event) => setCategory(event.target.value)} disabled={!country} className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}><option value="">{country ? "請選擇商品種類" : "請先選擇國家"}</option>{categoryOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className="col-span-2 text-sm font-semibold text-[#58534C]">供應商<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={inputClass}><option value="">尚未指定供應商</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} · {supplier.country}</option>)}</select><small className="mt-2 block font-normal text-xs text-[#938D84]">供應商可在之後從商品頁面新增或更換。</small></label>
            <label className="col-span-2 text-sm font-semibold text-[#58534C]">商品規格<input value={form.specification} onChange={(event) => updateForm("specification", event.target.value)} placeholder="例如：奶油白／單人" className={inputClass} /></label>
          </div>
        </Card>
        <Card className="p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PRICING</p><h2 className="mt-1 text-lg font-semibold">價格設定</h2><div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold text-[#58534C]">商品成本<input type="number" min="0" value={form.cost} onChange={(event) => updateForm("cost", event.target.value)} className={inputClass} /></label><label className="text-sm font-semibold text-[#58534C]">員工價<input type="number" min="0" value={form.staffPrice} onChange={(event) => updateForm("staffPrice", event.target.value)} className={inputClass} /></label><label className="text-sm font-semibold text-[#58534C]">一般售價<input type="number" min="0" value={form.retailPrice} onChange={(event) => updateForm("retailPrice", event.target.value)} className={inputClass} /></label></div></Card>
      </div>
      <aside className="h-fit rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6 xl:sticky xl:top-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">INVENTORY</p><h2 className="mt-1 text-lg font-semibold">初始庫存</h2><label className="mt-5 block text-sm font-semibold text-[#58534C]">可售庫存<input type="number" min="0" value={form.availableStock} onChange={(event) => updateForm("availableStock", event.target.value)} className={inputClass} /></label><label className="mt-4 block text-sm font-semibold text-[#58534C]">安全庫存<input type="number" min="0" value={form.safetyStock} onChange={(event) => updateForm("safetyStock", event.target.value)} className={inputClass} /></label><p className="mt-5 rounded-xl bg-[#F8F6F2] p-4 text-xs leading-5 text-[#746D63]">建立後可從庫存管理頁面持續調整進貨、保留與可售數量。</p><Primary onClick={saveProduct} disabled={saving} className="mt-5 w-full">{saving ? "儲存中…" : "儲存商品"}</Primary></aside>
    </div>
    <div className="mt-6 flex justify-center"><Secondary onClick={back} className="w-full sm:w-auto">取消新增</Secondary></div>
  </>;
}

type ImportRow = {
  sku: string;
  name: string;
  country: string;
  category: string;
  specification: string;
  cost: string;
  staffPrice: string;
  retailPrice: string;
  availableStock: string;
  safetyStock: string;
};

const importTemplateHeaders = ["商品編號", "商品名稱", "國家", "商品種類", "商品規格", "商品成本", "員工價", "一般售價", "可售庫存", "安全庫存"];
const importHeaderKeys: Record<string, keyof ImportRow> = {
  "商品編號": "sku", sku: "sku",
  "商品名稱": "name", name: "name",
  "國家": "country", country: "country",
  "商品種類": "category", category: "category",
  "商品規格": "specification", specification: "specification",
  "商品成本": "cost", cost: "cost",
  "員工價": "staffPrice", staffprice: "staffPrice",
  "一般售價": "retailPrice", retailprice: "retailPrice",
  "可售庫存": "availableStock", availablestock: "availableStock",
  "安全庫存": "safetyStock", safetystock: "safetyStock",
};

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { cells.push(value.trim()); value = ""; }
    else value += character;
  }
  cells.push(value.trim());
  return cells;
}

function ImportProducts({ back, onImported }: { back: () => void; onImported: (products: Product[]) => void }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);

  const downloadTemplate = () => {
    const sample = ["KR-001", "範例韓國商品", "韓國", "美妝", "粉色／單入", "200", "300", "450", "10", "3"];
    const csv = `\uFEFF${importTemplateHeaders.join(",")}\n${sample.join(",")}\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "wobuy174_商品匯入範本.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setNotice("");
    const content = (await file.text()).replace(/^\uFEFF/, "");
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    const headers = parseCsvLine(lines[0] ?? "").map((header) => header.trim());
    const keys = headers.map((header) => importHeaderKeys[header] ?? importHeaderKeys[header.toLowerCase()]);
    if (!keys.includes("sku") || !keys.includes("name") || !keys.includes("country") || !keys.includes("category")) {
      setError("欄位不完整。請使用下載的 CSV 範本，或至少包含商品編號、商品名稱、國家、商品種類。");
      setRows([]);
      return;
    }
    const importedRows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const row: ImportRow = { sku: "", name: "", country: "", category: "", specification: "", cost: "0", staffPrice: "0", retailPrice: "0", availableStock: "0", safetyStock: "0" };
      keys.forEach((key, index) => { if (key) row[key] = values[index] ?? ""; });
      return row;
    }).filter((row) => row.sku || row.name);
    if (!importedRows.length) {
      setError("檔案中沒有可匯入的商品資料。");
      return;
    }
    setRows(importedRows);
    setFileName(file.name);
  };

  const importProducts = async () => {
    if (!rows.length) return;
    setImporting(true);
    setError("");
    setNotice("");
    const imported: Product[] = [];
    const failed: string[] = [];
    for (const row of rows) {
      try {
        const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(row) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? result.error ?? "無法儲存。");
        if (result.product) imported.push(toProduct(result.product as StoredProduct));
      } catch (reason) {
        failed.push(`${row.sku || row.name}：${reason instanceof Error ? reason.message : "無法儲存"}`);
      }
    }
    if (imported.length) onImported(imported);
    if (failed.length) setError(`已匯入 ${imported.length} 筆；${failed.length} 筆未完成。${failed.slice(0, 2).join("　")}`);
    else setNotice(`已成功匯入 ${imported.length} 筆商品，也會同步至已設定的 Google 試算表。`);
    setImporting(false);
  };

  return <>
    <Header eyebrow="PRODUCT IMPORT" title="匯入商品" description="上傳 CSV 檔案後，系統會逐筆建立商品資料與初始庫存。"><Secondary onClick={back}>← 返回商品資料庫</Secondary></Header>
    {notice && <Card className="mb-5 border-[#D9E5DB] bg-[#EEF5EF] p-5"><b className="block text-[#34563D]">匯入完成</b><p className="mt-1 text-sm text-[#57735D]">{notice}</p></Card>}
    {error && <Card className="mb-5 border-[#F0D6C2] bg-[#FFF7F0] p-5"><b className="block text-[#965723]">請確認匯入資料</b><p className="mt-1 text-sm leading-6 text-[#A36B3C]">{error}</p></Card>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <Card className="p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CSV FILE</p><h2 className="mt-1 text-xl font-semibold">選擇商品檔案</h2><p className="mt-2 text-sm leading-6 text-[#807A72]">支援 CSV 格式。建議先下載範本，填寫完再上傳；商品編號不可重複。</p><div className="mt-6 rounded-2xl border border-dashed border-[#D9D4CC] bg-[#FCFBF9] p-6 text-center"><p className="text-sm font-semibold text-[#58534C]">{fileName || "尚未選擇檔案"}</p><p className="mt-1 text-xs text-[#918A81]">請上傳 .csv 檔案</p><label className={`${buttonClass} mt-5 cursor-pointer border border-[#E5E1DB] bg-white text-[#58544D] hover:bg-[#F8F6F2]`}><input className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => { void readFile(event.target.files?.[0]); }} />選擇 CSV 檔案</label></div>{rows.length > 0 && <div className="mt-6 overflow-x-auto rounded-xl border border-[#ECE8E2]"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[#FBFAF8] text-[11px] font-semibold text-[#928C83]"><tr><th className="px-4 py-3">商品編號</th><th className="px-3 py-3">商品名稱</th><th className="px-3 py-3">國家／種類</th><th className="px-3 py-3">一般售價</th><th className="px-4 py-3">可售庫存</th></tr></thead><tbody className="divide-y divide-[#F0EDE8]">{rows.slice(0, 8).map((row, index) => <tr key={`${row.sku}-${index}`}><td className="px-4 py-3 font-mono text-xs">{row.sku}</td><td className="px-3 py-3 font-semibold">{row.name}</td><td className="px-3 py-3 text-[#706A61]">{row.country} · {row.category}</td><td className="px-3 py-3">{currency(Number(row.retailPrice) || 0)}</td><td className="px-4 py-3">{row.availableStock || 0}</td></tr>)}</tbody></table>{rows.length > 8 && <p className="border-t border-[#F0EDE8] px-4 py-3 text-xs text-[#8B847A]">另有 {rows.length - 8} 筆商品將一併匯入。</p>}</div>}</Card>
      <aside className="h-fit space-y-5 xl:sticky xl:top-6"><Card className="p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">IMPORT GUIDE</p><h2 className="mt-1 text-lg font-semibold">匯入說明</h2><ol className="mt-4 space-y-3 text-sm leading-6 text-[#756F66]"><li>1. 下載 CSV 範本。</li><li>2. 填寫商品資料並保留第一列欄位名稱。</li><li>3. 選擇 CSV 檔案後確認預覽。</li><li>4. 按下匯入商品，完成後至商品資料庫查看。</li></ol><Secondary onClick={downloadTemplate} className="mt-5 w-full">下載 CSV 範本</Secondary></Card><Card className="p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">READY TO IMPORT</p><h2 className="mt-1 text-lg font-semibold">待匯入商品</h2><p className="mt-3 text-3xl font-semibold tracking-[-.05em]">{rows.length} <span className="text-base text-[#847E75]">筆</span></p><Primary onClick={() => { void importProducts(); }} disabled={!rows.length || importing} className="mt-5 w-full">{importing ? "匯入中…" : "確認匯入商品"}</Primary></Card></aside>
    </div>
  </>;
}

function CustomerManagement() {
  const emptyForm = { name: "", lineName: "", phone: "", address: "" };
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/customers");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法讀取客戶資料。");
      setCustomers(result.customers ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法讀取客戶資料。");
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadCustomers(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(""); setNotice(""); setShowForm(true); };
  const openEdit = (customer: Customer) => { setEditing(customer); setForm({ name: customer.name, lineName: customer.line_name, phone: customer.phone, address: customer.address }); setError(""); setNotice(""); setShowForm(true); };
  const updateForm = (field: keyof typeof emptyForm, value: string) => setForm((previous) => ({ ...previous, [field]: value }));
  const saveCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/customers", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? { ...form, id: editing.id } : form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法儲存客戶資料。");
      setCustomers((previous) => editing ? previous.map((customer) => customer.id === result.customer.id ? result.customer : customer) : [result.customer, ...previous]);
      setNotice(editing ? "客戶資料已更新。" : "客戶資料已建立。" );
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法儲存客戶資料。"); }
    finally { setSaving(false); }
  };
  const removeCustomer = async (customer: Customer) => {
    if (!window.confirm(`確定要刪除「${customer.name}」的客戶資料嗎？`)) return;
    setError("");
    try {
      const response = await fetch(`/api/customers?id=${encodeURIComponent(customer.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法刪除客戶資料。");
      setCustomers((previous) => previous.filter((item) => item.id !== customer.id));
      setNotice("客戶資料已刪除。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法刪除客戶資料。"); }
  };
  const visibleCustomers = customers.filter((customer) => [customer.name, customer.line_name, customer.phone, customer.address].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const inputClass = "mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none placeholder:text-[#AAA39A]";

  return <>
    <Header eyebrow="CUSTOMERS" title="客戶管理" description="集中管理客戶姓名、LINE@、電話與配送地址。"><Primary onClick={openNew}>＋ 新增客戶</Primary></Header>
    {notice && <Card className="mb-5 border-[#D9E5DB] bg-[#EEF5EF] p-4 text-sm font-semibold text-[#45634C]">{notice}</Card>}
    {error && <Card className="mb-5 border-[#F0D6C2] bg-[#FFF7F0] p-4 text-sm font-semibold text-[#9B562A]">{error}</Card>}
    {showForm && <Card className="mb-5 p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CUSTOMER FORM</p><h2 className="mt-1 text-xl font-semibold">{editing ? "編輯客戶" : "新增客戶"}</h2></div><button aria-label="關閉客戶表單" onClick={() => setShowForm(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg text-[#777168]">×</button></div><form onSubmit={saveCustomer} className="mt-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#58534C]">客戶姓名<input required value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="例如：王思妤" className={inputClass} /></label><label className="text-sm font-semibold text-[#58534C]">LINE@名稱<input value={form.lineName} onChange={(event) => updateForm("lineName", event.target.value)} placeholder="例如：@szu.yi" className={inputClass} /></label><label className="text-sm font-semibold text-[#58534C]">電話<input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="例如：0912-456-789" className={inputClass} /></label><label className="text-sm font-semibold text-[#58534C]">地址<input value={form.address} onChange={(event) => updateForm("address", event.target.value)} placeholder="例如：台南市中西區府前路一段 120 號" className={inputClass} /></label></div><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Secondary onClick={() => setShowForm(false)}>取消</Secondary><Primary type="submit" disabled={saving}>{saving ? "儲存中…" : "儲存客戶"}</Primary></div></form></Card>}
    <Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-[#F0EDE8] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><Search value={query} onChange={setQuery} placeholder="搜尋客戶姓名、LINE@、電話或地址" /><span className="text-xs text-[#807A71]">共 {customers.length} 位客戶</span></div><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">客戶姓名</th><th className="px-3 py-3">LINE@名稱</th><th className="px-3 py-3">電話</th><th className="px-3 py-3">地址</th><th className="px-6 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{loading ? <tr><td colSpan={5} className="px-6 py-10 text-center text-[#8D877E]">載入客戶資料中…</td></tr> : visibleCustomers.length ? visibleCustomers.map((customer) => <tr key={customer.id} className="hover:bg-[#FCFBF9]"><td className="px-6 py-4 font-semibold text-[#4A4640]">{customer.name}</td><td className="px-3 py-4 text-[#625D55]">{customer.line_name || "—"}</td><td className="px-3 py-4 text-[#625D55]">{customer.phone || "—"}</td><td className="px-3 py-4 text-[#625D55]">{customer.address || "—"}</td><td className="px-6 py-4 text-right"><button onClick={() => openEdit(customer)} className="mr-4 text-sm font-semibold text-[#5E7665]">編輯</button><button onClick={() => { void removeCustomer(customer); }} className="text-sm font-semibold text-[#A35F37]">刪除</button></td></tr>) : <tr><td colSpan={5} className="px-6 py-10 text-center text-[#8D877E]">尚無客戶資料。請按「新增客戶」建立第一位客戶。</td></tr>}</tbody></table></div></Card>
  </>;
}

function SupplierManagement() {
  const emptyForm = { name: "", country: "", transactionMethod: "", moq: "", paymentMethod: "轉帳" };
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/suppliers");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法讀取供應商資料。");
      setSuppliers(result.suppliers ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法讀取供應商資料。");
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadSuppliers(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(""); setNotice(""); setShowForm(true); };
  const openEdit = (supplier: Supplier) => { setEditing(supplier); setForm({ name: supplier.name, country: supplier.country, transactionMethod: supplier.transaction_method, moq: supplier.moq, paymentMethod: supplier.payment_method }); setError(""); setNotice(""); setShowForm(true); };
  const updateForm = (field: keyof typeof emptyForm, value: string) => setForm((previous) => ({ ...previous, [field]: value }));
  const saveSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/suppliers", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? { ...form, id: editing.id } : form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法儲存供應商資料。");
      setSuppliers((previous) => editing ? previous.map((supplier) => supplier.id === result.supplier.id ? result.supplier : supplier) : [result.supplier, ...previous]);
      setNotice(editing ? "供應商資料已更新。" : "供應商資料已建立。");
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法儲存供應商資料。"); }
    finally { setSaving(false); }
  };
  const removeSupplier = async (supplier: Supplier) => {
    if (!window.confirm(`確定要刪除「${supplier.name}」的供應商資料嗎？`)) return;
    setError("");
    try {
      const response = await fetch(`/api/suppliers?id=${encodeURIComponent(supplier.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法刪除供應商資料。");
      setSuppliers((previous) => previous.filter((item) => item.id !== supplier.id));
      setNotice("供應商資料已刪除。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "無法刪除供應商資料。"); }
  };
  const visibleSuppliers = suppliers.filter((supplier) => [supplier.name, supplier.country, supplier.transaction_method, supplier.moq, supplier.payment_method].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const inputClass = "mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none placeholder:text-[#AAA39A]";
  const formatDate = (value: string) => new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));

  return <>
    <Header eyebrow="SUPPLIERS" title="供應商管理" description="集中管理供應商資料、交易條件與最低訂購量。"><Primary onClick={openNew}>＋ 新增供應商</Primary></Header>
    {notice && <Card className="mb-5 border-[#D9E5DB] bg-[#EEF5EF] p-4 text-sm font-semibold text-[#45634C]">{notice}</Card>}
    {error && <Card className="mb-5 border-[#F0D6C2] bg-[#FFF7F0] p-4 text-sm font-semibold text-[#9B562A]">{error}</Card>}
    {showForm && <Card className="mb-5 p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">SUPPLIER FORM</p><h2 className="mt-1 text-xl font-semibold">{editing ? "編輯供應商" : "新增供應商"}</h2></div><button aria-label="關閉供應商表單" onClick={() => setShowForm(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg text-[#777168]">×</button></div><form onSubmit={saveSupplier} className="mt-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#58534C]">供應商名稱<input required value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="例如：Seoul Daily" className={inputClass} /></label><label className="text-sm font-semibold text-[#58534C]">國家<input required value={form.country} onChange={(event) => updateForm("country", event.target.value)} placeholder="例如：韓國" className={inputClass} /></label><label className="text-sm font-semibold text-[#58534C]">交易方式<input value={form.transactionMethod} onChange={(event) => updateForm("transactionMethod", event.target.value)} placeholder="例如：批發、代購、現貨採購" className={inputClass} /></label><label className="text-sm font-semibold text-[#58534C]">MOQ<input value={form.moq} onChange={(event) => updateForm("moq", event.target.value)} placeholder="例如：10 件／NT$ 5,000" className={inputClass} /></label><label className="text-sm font-semibold text-[#58534C]">付款方式<select value={form.paymentMethod} onChange={(event) => updateForm("paymentMethod", event.target.value)} className={inputClass}><option>現金</option><option>轉帳</option><option>信用卡</option></select></label></div><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Secondary onClick={() => setShowForm(false)}>取消</Secondary><Primary type="submit" disabled={saving}>{saving ? "儲存中…" : "儲存供應商"}</Primary></div></form></Card>}
    <Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-[#F0EDE8] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><Search value={query} onChange={setQuery} placeholder="搜尋供應商名稱、國家或交易方式" /><span className="text-xs text-[#807A71]">共 {suppliers.length} 家供應商</span></div><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">供應商名稱</th><th className="px-3 py-3">國家</th><th className="px-3 py-3">建立日期</th><th className="px-3 py-3">交易方式</th><th className="px-3 py-3">MOQ</th><th className="px-3 py-3">付款方式</th><th className="px-6 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{loading ? <tr><td colSpan={7} className="px-6 py-10 text-center text-[#8D877E]">載入供應商資料中…</td></tr> : visibleSuppliers.length ? visibleSuppliers.map((supplier) => <tr key={supplier.id} className="hover:bg-[#FCFBF9]"><td className="px-6 py-4 font-semibold text-[#4A4640]">{supplier.name}</td><td className="px-3 py-4 text-[#625D55]">{supplier.country}</td><td className="px-3 py-4 text-[#625D55]">{formatDate(supplier.created_at)}</td><td className="px-3 py-4 text-[#625D55]">{supplier.transaction_method || "—"}</td><td className="px-3 py-4 text-[#625D55]">{supplier.moq || "—"}</td><td className="px-3 py-4"><Pill tone="green">{supplier.payment_method}</Pill></td><td className="px-6 py-4 text-right"><button onClick={() => openEdit(supplier)} className="mr-4 text-sm font-semibold text-[#5E7665]">編輯</button><button onClick={() => { void removeSupplier(supplier); }} className="text-sm font-semibold text-[#A35F37]">刪除</button></td></tr>) : <tr><td colSpan={7} className="px-6 py-10 text-center text-[#8D877E]">尚無供應商資料。請按「新增供應商」建立第一家供應商。</td></tr>}</tbody></table></div></Card>
  </>;
}

function LegacyProductPage({ product, stock, back, openStock }: { product: Product; stock: number; back: () => void; openStock: () => void }) {
  const basic = [["商品編號", product.sku], ["商品名稱", product.name], ["國家", product.country], ["商品種類", product.category], ["商品規格", product.specification]];
  const price = [["商品成本", currency(product.cost)], ["員工價", currency(product.staffPrice)], ["一般售價", currency(product.retailPrice)]];
  return <><Header eyebrow="PRODUCT DETAIL" title={product.name} description={`商品編號：${product.sku}。完整管理商品資料、價格與庫存。`}><Secondary onClick={back}>← 返回商品資料庫</Secondary></Header><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><div className="space-y-5"><Card className="p-5 sm:p-6"><div className="flex items-start gap-4"><ProductTile product={product}/><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PRODUCT PROFILE</p><h2 className="mt-1 text-xl font-semibold">{product.name}</h2><p className="mt-1 text-sm text-[#807A72]">{product.country} · {product.category} · {product.specification}</p></div><Pill tone="green">已上架</Pill></div><div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-[#ECE8E2] bg-[#ECE8E2] sm:grid-cols-2">{basic.map(([label, value]) => <div key={label} className="bg-white p-4"><p className="text-xs font-semibold text-[#938D84]">{label}</p><p className="mt-2 text-sm font-semibold text-[#48433C]">{value}</p></div>)}</div></Card><Card className="p-5 sm:p-6"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PRICING</p><h2 className="mt-1 text-lg font-semibold">價格設定</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{price.map(([label, value]) => <div key={label} className="rounded-xl bg-[#F8F6F2] p-4"><p className="text-xs font-semibold text-[#8A8379]">{label}</p><p className="mt-2 text-lg font-semibold tracking-[-.03em] text-[#36322E]">{value}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-[#938D84]">員工價僅供內部員工訂購時使用；一般售價會套用於新建立的客戶訂單。</p></Card></div><aside className="space-y-5"><Card className="p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">INVENTORY</p><h2 className="mt-1 text-lg font-semibold">庫存資訊</h2><div className="mt-5 divide-y divide-[#F0EDE8]">{[["實際在庫", String(stock + product.reserved)], ["已保留", String(product.reserved)], ["可售庫存", String(stock)], ["到貨中", String(product.incoming)], ["安全庫存", String(product.safety)]].map(([label, value]) => <div key={label} className="flex justify-between py-3 text-sm"><span className="text-[#7A746B]">{label}</span><b className={label === "可售庫存" ? "text-[#45634C]" : "text-[#45413B]"}>{value}</b></div>)}</div><Secondary onClick={openStock} className="mt-5 w-full">調整庫存</Secondary></Card><Card className="p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">RECENT ACTIVITY</p><h2 className="mt-1 text-lg font-semibold">最近異動</h2><div className="mt-5 space-y-4 text-sm">{[["今天 10:42", "訂單確認", "可售庫存 − 1"], ["昨天 16:20", "入庫完成", "實際在庫 + 24"], ["07.18 11:08", "庫存調整", "盤點差異 − 1"]].map(([time, action, change]) => <div key={time} className="border-l border-[#D7E4D9] pl-3"><p className="text-xs text-[#938D84]">{time}</p><p className="mt-1 font-semibold text-[#4A4640]">{action}</p><p className="mt-1 text-xs text-[#6C776D]">{change}</p></div>)}</div></Card></aside></div></>;
}

function ProductPage({ product, stock, back, openStock, onUpdated }: { product: Product; stock: number; back: () => void; openStock: () => void; onUpdated: (product: Product) => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState(product.supplierId ?? "");
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const basic = [["商品編號", product.sku], ["商品名稱", product.name], ["國家", product.country], ["商品種類", product.category], ["商品規格", product.specification]];
  const price = [["商品成本", currency(product.cost)], ["員工價", currency(product.staffPrice)], ["一般售價", currency(product.retailPrice)]];
  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);

  useEffect(() => { setSupplierId(product.supplierId ?? ""); setNotice(""); setError(""); }, [product.id, product.supplierId]);
  useEffect(() => {
    let active = true;
    const loadSuppliers = async () => {
      try {
        const response = await fetch("/api/suppliers");
        const result = await response.json();
        if (response.ok && active) setSuppliers(result.suppliers ?? []);
      } catch {
        if (active) setError("無法載入供應商清單。");
      }
    };
    void loadSuppliers();
    return () => { active = false; };
  }, []);

  const saveSupplier = async () => {
    if (typeof product.id !== "string") { setError("示範商品無法串聯供應商；請先建立為資料庫商品。"); return; }
    setSavingSupplier(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "linkSupplier", id: product.id, supplierId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法更新商品供應商。");
      if (result.product) onUpdated(toProduct(result.product as StoredProduct));
      setNotice(supplierId ? `已連結供應商：${selectedSupplier?.name ?? "供應商"}。` : "已取消供應商連結。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法更新商品供應商。");
    } finally {
      setSavingSupplier(false);
    }
  };

  return <><Header eyebrow="PRODUCT DETAIL" title={product.name} description={`商品編號：${product.sku}。完整管理商品資料、價格、供應商與庫存。`}><Secondary onClick={back}>← 返回商品資料庫</Secondary></Header><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><div className="space-y-5"><Card className="p-5 sm:p-6"><div className="flex items-start gap-4"><ProductTile product={product}/><div className="min-w-0 flex-1"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PRODUCT PROFILE</p><h2 className="mt-1 text-xl font-semibold">{product.name}</h2><p className="mt-1 text-sm text-[#807A72]">{product.country} · {product.category} · {product.specification}</p></div><Pill tone="green">已上架</Pill></div><div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-[#ECE8E2] bg-[#ECE8E2] sm:grid-cols-2">{basic.map(([label, value]) => <div key={label} className="bg-white p-4"><p className="text-xs font-semibold text-[#938D84]">{label}</p><p className="mt-2 text-sm font-semibold text-[#48433C]">{value}</p></div>)}<div className="bg-white p-4 sm:col-span-2"><p className="text-xs font-semibold text-[#938D84]">目前供應商</p><p className="mt-2 text-sm font-semibold text-[#48433C]">{selectedSupplier?.name ?? product.supplierName ?? "尚未連結供應商"}</p></div></div><div className="mt-5 rounded-xl bg-[#F8F6F2] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-sm font-semibold text-[#58534C]">供應商<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} disabled={savingSupplier} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none disabled:opacity-50"><option value="">尚未指定供應商</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} · {supplier.country}</option>)}</select></label><Primary onClick={() => { void saveSupplier(); }} disabled={savingSupplier} className="shrink-0">{savingSupplier ? "儲存中…" : "儲存供應商"}</Primary></div><p className="mt-3 text-xs leading-5 text-[#8B847A]">連結後可從此商品快速確認主要採購來源。</p>{notice && <p className="mt-3 text-sm font-semibold text-[#45634C]">{notice}</p>}{error && <p className="mt-3 text-sm font-semibold text-[#A35F37]">{error}</p>}</div></Card><Card className="p-5 sm:p-6"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PRICING</p><h2 className="mt-1 text-lg font-semibold">價格設定</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{price.map(([label, value]) => <div key={label} className="rounded-xl bg-[#F8F6F2] p-4"><p className="text-xs font-semibold text-[#8A8379]">{label}</p><p className="mt-2 text-lg font-semibold tracking-[-.03em] text-[#36322E]">{value}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-[#938D84]">員工價僅供內部員工訂購時使用；一般售價會套用於新建立的客戶訂單。</p></Card></div><aside className="space-y-5"><Card className="p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">INVENTORY</p><h2 className="mt-1 text-lg font-semibold">庫存資訊</h2><div className="mt-5 divide-y divide-[#F0EDE8]">{[["實際在庫", String(stock + product.reserved)], ["已保留", String(product.reserved)], ["可售庫存", String(stock)], ["到貨中", String(product.incoming)], ["安全庫存", String(product.safety)]].map(([label, value]) => <div key={label} className="flex justify-between py-3 text-sm"><span className="text-[#7A746B]">{label}</span><b className={label === "可售庫存" ? "text-[#45634C]" : "text-[#45413B]"}>{value}</b></div>)}</div><Secondary onClick={openStock} className="mt-5 w-full">調整庫存</Secondary></Card></aside></div></>;
}

function LegacyInventoryManagement({ go }: { go: (view: View) => void }) {
  return <><Header eyebrow="INVENTORY OPERATIONS" title="庫存管理" description="執行入庫、調整、盤點與倉庫調撥作業。"><Secondary onClick={() => go("stock")}>查看庫存總覽</Secondary><Primary onClick={() => go("stock")}>開始盤點</Primary></Header><div className="grid gap-4 md:grid-cols-3">{[["庫存調整", "記錄損壞、樣品、盤點差異等異動。", "＋ 新增調整"], ["倉庫調撥", "在不同倉庫或庫位間移動商品。", "＋ 建立調撥"], ["庫存盤點", "比對系統數量與實際數量，維持資料正確。", "開始盤點"]].map(([title, description, action], index) => <Card key={title} className="p-5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0F4EF] text-[11px] font-bold text-[#58715E]">0{index + 1}</span><h2 className="mt-5 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#817B72]">{description}</p><button onClick={() => go("stock")} className="mt-6 text-sm font-semibold text-[#5E7665]">{action} →</button></Card>)}</div><Card className="mt-5 overflow-hidden"><div className="flex items-center justify-between p-5 sm:p-6"><div><h2 className="font-semibold">近期庫存異動</h2><p className="mt-1 text-sm text-[#898379]">每次變動都會保留來源、數量與操作人員。</p></div><button onClick={() => go("stock")} className="text-sm font-semibold text-[#5E7665]">庫存總覽 →</button></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">時間</th><th className="px-3 py-3">商品</th><th className="px-3 py-3">異動類型</th><th className="px-3 py-3">數量</th><th className="px-6 py-3">操作人員</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{[["10:42","雲朵感純棉四季被","訂單確認","可售庫存 − 1","怡文"],["09:50","霧面日常隨行杯","庫存調整","實際在庫 + 12","小芸"],["昨天 16:20","刺繡小熊收納化妝包","採購收貨","實際在庫 + 30","怡文"]].map(row => <tr key={row[0]}>{row.map((cell, i) => <td key={i} className={`px-3 py-4 ${i === 0 || i === 4 ? "text-[#8D877E]" : "text-[#4F4A43]"} ${i === 0 || i === 4 ? "first:pl-6 last:pr-6" : ""}`}>{cell}</td>)}</tr>)}</tbody></table></div></Card></>;
}

function LegacyStockOverview({ stock, openProduct, adjustStock }: { stock: Record<string, number>; openProduct: (id: number) => void; adjustStock: (id: number, quantity: number) => void }) {
  const [countryFilter, setCountryFilter] = useState("全部國家");
  const [categoryFilter, setCategoryFilter] = useState("全部商品種類");
  const [statusFilter, setStatusFilter] = useState("全部狀態");
  const [query, setQuery] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustmentProductId, setAdjustmentProductId] = useState(products[0].id);
  const [adjustment, setAdjustment] = useState("0");
  const [adjustmentReason, setAdjustmentReason] = useState("盤點差異");
  const [notice, setNotice] = useState("");
  const countries = Object.keys(productCategoriesByCountry);
  const categoryOptions = countryFilter === "全部國家" ? Array.from(new Set(products.map((product) => product.category))) : productCategoriesByCountry[countryFilter] ?? [];
  const stockValue = (product: Product) => stock[String(product.id)] ?? product.available;
  const visibleProducts = products.filter((product) => {
    const lowStock = stockValue(product) <= product.safety;
    const matchesQuery = !query.trim() || [product.name, product.sku, product.country, product.category].join(" ").toLowerCase().includes(query.trim().toLowerCase());
    return (countryFilter === "全部國家" || product.country === countryFilter)
      && (categoryFilter === "全部商品種類" || product.category === categoryFilter)
      && (statusFilter === "全部狀態" || (statusFilter === "低庫存" ? lowStock : !lowStock))
      && matchesQuery;
  });
  const selectClass = "h-9 w-full rounded-xl border border-[#E5E1DB] bg-white px-3 text-xs font-semibold text-[#58544D] outline-none";
  const selectedProduct = products.find((product) => product.id === adjustmentProductId) ?? products[0];
  const adjustmentQuantity = Number(adjustment) || 0;
  const selectedAvailable = stockValue(selectedProduct);
  const canApplyAdjustment = adjustmentQuantity !== 0 && selectedAvailable + adjustmentQuantity >= 0;
  const actualTotal = products.reduce((total, product) => total + stockValue(product) + product.reserved, 0);
  const availableTotal = products.reduce((total, product) => total + stockValue(product), 0);
  const reservedTotal = products.reduce((total, product) => total + product.reserved, 0);
  const lowStockCount = products.filter((product) => stockValue(product) <= product.safety).length;
  const openAdjustment = () => {
    setAdjustmentProductId(visibleProducts[0]?.id ?? products[0].id);
    setAdjustment("0");
    setNotice("");
    setAdjusting(true);
  };
  const saveAdjustment = () => {
    if (!canApplyAdjustment) return;
    adjustStock(selectedProduct.id, adjustmentQuantity);
    setNotice(`${selectedProduct.name} 已${adjustmentQuantity > 0 ? "增加" : "扣除"} ${Math.abs(adjustmentQuantity)} 件。`);
    setAdjusting(false);
  };
  const exportStock = () => {
    const header = ["商品編號", "商品名稱", "國家", "商品種類", "實際在庫", "已保留", "可售庫存", "到貨中", "安全庫存"];
    const rows = products.map((product) => [product.sku, product.name, product.country, product.category, stockValue(product) + product.reserved, product.reserved, stockValue(product), product.incoming, product.safety]);
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "wobuy174_庫存總覽.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return <>
    <Header eyebrow="STOCK OVERVIEW" title="庫存總覽" description="以單一商品為單位，查看每筆可售、保留與到貨中的庫存。"><Secondary onClick={exportStock}>匯出庫存</Secondary><Primary onClick={openAdjustment}>＋ 調整庫存</Primary></Header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="實際在庫總量" value={`${actualTotal.toLocaleString("zh-TW")} 件`} note="包含 3 個庫位" /><Metric label="可售庫存總量" value={`${availableTotal.toLocaleString("zh-TW")} 件`} note="可立即建立新訂單" accent /><Metric label="已保留庫存" value={`${reservedTotal.toLocaleString("zh-TW")} 件`} note="已確認訂單所占用" /><Metric label="低庫存品項" value={`${String(lowStockCount).padStart(2, "0")} 項`} note="低於設定的安全庫存" /></section>
    {notice && <div role="status" className="mt-4 flex items-center justify-between rounded-xl border border-[#D9E5DB] bg-[#EEF5EF] px-4 py-3 text-sm font-semibold text-[#4D7054]"><span>{notice}</span><button aria-label="關閉提示" onClick={() => setNotice("")} className="text-[#5D7B63]">×</button></div>}
    <Card className="mt-5 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#F0EDE8] p-5 sm:p-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><Search value={query} onChange={setQuery} placeholder="搜尋商品名稱、商品編號或庫位" /><span className="text-xs text-[#807A71]">顯示 {visibleProducts.length} 項商品</span></div><div className="grid w-full gap-2 sm:max-w-[497px] sm:grid-cols-3"><select aria-label="國家篩選" value={countryFilter} onChange={(event) => { setCountryFilter(event.target.value); setCategoryFilter("全部商品種類"); }} className={selectClass}><option>全部國家</option>{countries.map((country) => <option key={country}>{country}</option>)}</select><select aria-label="商品種類篩選" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={selectClass}><option>全部商品種類</option>{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select><select aria-label="庫存狀態篩選" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={selectClass}><option>全部狀態</option><option>正常庫存</option><option>低庫存</option></select></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">商品</th><th className="px-3 py-3">商品編號</th><th className="px-3 py-3">實際在庫</th><th className="px-3 py-3">已保留</th><th className="px-3 py-3">可售庫存</th><th className="px-3 py-3">到貨中</th><th className="px-3 py-3">安全庫存</th><th className="px-6 py-3 text-right">商品頁面</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{visibleProducts.length ? visibleProducts.map((product) => { const available = stockValue(product); return <tr key={product.id} className="hover:bg-[#FCFBF9]"><td className="px-6 py-4"><button onClick={() => openProduct(product.id)} className="flex items-center gap-3 text-left"><ProductTile product={product} small /><span><b className="block text-[#4A4640]">{product.name}</b><small className="block pt-1 text-xs text-[#938D84]">{product.specification}</small></span></button></td><td className="px-3 py-4 font-mono text-xs text-[#6E695F]">{product.sku}</td><td className="px-3 py-4">{available + product.reserved}</td><td className="px-3 py-4">{product.reserved}</td><td className={`px-3 py-4 font-bold ${available <= product.safety ? "text-[#A66932]" : "text-[#45634C]"}`}>{available}</td><td className="px-3 py-4">{product.incoming || "—"}</td><td className="px-3 py-4">{product.safety}</td><td className="px-6 py-4 text-right"><button onClick={() => openProduct(product.id)} className="text-sm font-semibold text-[#5E7665]">查看商品 →</button></td></tr>; }) : <tr><td colSpan={8} className="px-6 py-10 text-center text-[#8D877E]">找不到符合條件的商品。</td></tr>}</tbody></table></div>
    </Card>
    {adjusting && <div className="fixed inset-0 z-50 flex items-end bg-[#292824]/35 sm:items-center sm:justify-center sm:p-6"><div role="dialog" aria-modal="true" aria-labelledby="adjust-stock-title" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">STOCK ADJUSTMENT</p><h2 id="adjust-stock-title" className="mt-2 text-xl font-semibold">調整庫存</h2><p className="mt-2 text-sm leading-6 text-[#7D776E]">請填寫本次異動的商品、數量與原因。</p></div><button aria-label="關閉調整庫存" onClick={() => setAdjusting(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg text-[#777168]">×</button></div><div className="mt-6 grid gap-4"><label className="text-sm font-semibold text-[#575149]">商品<select value={adjustmentProductId} onChange={(event) => setAdjustmentProductId(Number(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-[#E5E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none">{products.map((product) => <option key={product.id} value={product.id}>{product.country} · {product.category}｜{product.name}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#575149]">異動數量<input type="number" inputMode="numeric" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E5E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#575149]">異動原因<select value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E5E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"><option>盤點差異</option><option>採購入庫</option><option>損壞報廢</option><option>樣品領用</option><option>其他調整</option></select></label></div><div className="rounded-xl bg-[#F8F6F2] p-4 text-sm"><div className="flex justify-between"><span className="text-[#787168]">目前可售庫存</span><b>{selectedAvailable} 件</b></div><div className="mt-2 flex justify-between"><span className="text-[#787168]">調整後可售庫存</span><b className={canApplyAdjustment ? "text-[#45634C]" : "text-[#A66932]"}>{selectedAvailable + adjustmentQuantity} 件</b></div>{adjustmentQuantity < 0 && !canApplyAdjustment && <p className="mt-3 text-xs text-[#A66932]">扣除數量不可超過目前可售庫存。</p>}<p className="mt-3 text-xs text-[#938D84]">異動原因：{adjustmentReason}</p></div></div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Secondary onClick={() => setAdjusting(false)}>取消</Secondary><Primary onClick={saveAdjustment} disabled={!canApplyAdjustment}>儲存調整</Primary></div></div></div>}
  </>;
}

function GenericPage({ view, go }: { view: "purchases" | "reports" | "settings"; go: (view: View) => void }) {
  const info = { purchases: ["PURCHASING", "採購與供應商", "管理供應商資料、採購單與進貨作業。", "＋ 建立採購單"], reports: ["ANALYTICS", "報表中心", "從銷售與庫存資料中掌握補貨、商品與營運表現。", "匯出報表"], settings: ["SETTINGS", "系統設定", "管理倉庫、訂單編號、權限與通知規則。", "儲存設定"] }[view];
  return <><Header eyebrow={info[0]} title={info[1]} description={info[2]}><Primary onClick={view === "purchases" ? () => go("newPurchase") : undefined}>{info[3]}</Primary></Header><div className="grid gap-5 md:grid-cols-2">{view === "purchases" ? <><Card className="p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PURCHASE ORDERS</p><h2 className="mt-2 text-xl font-semibold">進行中的採購單</h2><div className="mt-5 space-y-4">{[["#PO-260721-04", "Seoul Daily", "今天", "待收貨"], ["#PO-260718-03", "Mori Select", "7/22", "部分收貨"], ["#PO-260716-02", "Atelier Home", "7/25", "已發送"]].map(([id, vendor, date, state]) => <div key={id} className="flex items-center justify-between border-b border-[#F0EDE8] pb-4"><span><b className="block text-sm">{id}</b><small className="mt-1 block text-xs text-[#938D84]">{vendor} · 預計 {date} 到貨</small></span><Pill tone="blue">{state}</Pill></div>)}</div></Card><Card className="p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">SUPPLIERS</p><h2 className="mt-2 text-xl font-semibold">常用供應商</h2><p className="mt-2 text-sm text-[#898379]">集中管理供應商資料、交易條件與最低訂購量。</p><Secondary onClick={() => go("suppliers")} className="mt-6">管理供應商</Secondary></Card></> : view === "reports" ? <><Metric label="銷售總額" value="NT$ 284,600" note="本月累計 · +16.8%" accent/><Metric label="商品售罄率" value="72.4%" note="售出／可售庫存"/><Card className="p-6"><h2 className="font-semibold">銷售概況</h2><div className="mt-8 flex h-40 items-end gap-2">{[35,58,48,72,52,88,65,92,74,83,68,95].map((h,i) => <span key={i} className={`flex-1 rounded-t-md ${i===11?"bg-[#738C7A]":"bg-[#DFE8E1]"}`} style={{height:`${h}%`}} />)}</div></Card><Card className="p-6"><h2 className="font-semibold">本月熱銷商品</h2><div className="mt-5 space-y-4">{products.slice(0,3).map((product,i)=><div key={product.id}><div className="flex justify-between text-sm"><b>{product.name}</b><span className="text-[#5E7665]">{86-i*12} 件</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F0EDE8]"><span className="block h-full rounded-full bg-[#86A28E]" style={{width:`${94-i*13}%`}}/></div></div>)}</div></Card></> : <><Card className="p-6"><h2 className="font-semibold">基本設定</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{[["品牌名稱","MUSE STOCK"],["預設幣別","TWD · 新台幣"],["時區","Asia/Taipei"],["訂單編號前綴","WB"]].map(([label,value])=><label key={label} className="text-sm font-semibold text-[#58534C]">{label}<input defaultValue={value} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"/></label>)}</div></Card><Card className="p-6"><h2 className="font-semibold">通知設定</h2><div className="mt-4 divide-y divide-[#F0EDE8]">{["低庫存提醒","待確認訂單提醒","取消訂單自動回補庫存"].map(title=><div key={title} className="flex items-center justify-between py-4"><span><b className="block text-sm">{title}</b><small className="mt-1 block text-xs text-[#938D84]">系統將在需要處理時通知管理人員。</small></span><span className="relative h-6 w-11 rounded-full bg-[#78957E]"><i className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white"/></span></div>)}</div></Card></>}</div></>;
}

function SystemSettings({ currentUser }: { currentUser: CurrentUser }) {
  const isAdmin = currentUser.role === "admin";
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(isAdmin);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ displayName: "", email: "", password: "", role: "staff" as "admin" | "staff" });

  const loadUsers = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法讀取帳號清單。");
      setUsers(result.users ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法讀取帳號清單。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadUsers(); }, [isAdmin]);

  const addUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法建立帳號。");
      setUsers((previous) => [...previous, result.user]);
      setForm({ displayName: "", email: "", password: "", role: "staff" });
      setShowForm(false);
      setNotice("帳號已建立，可使用設定的 Email 與密碼登入。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法建立帳號。");
    } finally {
      setCreating(false);
    }
  };

  const updateRole = async (user: ManagedUser, role: "admin" | "staff") => {
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, role }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法更新權限。");
      setUsers((previous) => previous.map((item) => item.id === user.id ? result.user : item));
      setNotice("帳號權限已更新。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法更新權限。");
    }
  };

  const removeUser = async (user: ManagedUser) => {
    if (!window.confirm(`確定要刪除 ${user.display_name || user.email} 的帳號嗎？`)) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法刪除帳號。");
      setUsers((previous) => previous.filter((item) => item.id !== user.id));
      setNotice("帳號已刪除。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法刪除帳號。");
    }
  };

  return <>
    <Header eyebrow="SETTINGS" title="系統設定" description="管理後台帳號、角色權限與系統偏好。" />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">ACCOUNT MANAGEMENT</p><h2 className="mt-2 text-xl font-semibold">系統帳號管理</h2><p className="mt-2 text-sm leading-6 text-[#807A72]">管理員可建立帳號、指定管理員或員工角色，以及移除離職帳號。</p></div>
            {isAdmin && <Primary onClick={() => { setShowForm((value) => !value); setError(""); }}>＋ 建立帳號</Primary>}
          </div>

          {notice && <p role="status" className="mt-5 rounded-xl border border-[#D7E7D9] bg-[#EEF5EF] px-4 py-3 text-sm font-semibold text-[#45634C]">{notice}</p>}
          {error && <p role="alert" className="mt-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] px-4 py-3 text-sm font-semibold text-[#9B562A]">{error}</p>}

          {showForm && <form onSubmit={addUser} className="mt-5 rounded-2xl border border-[#E9E5DF] bg-[#FCFBF9] p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#58534C]">顯示名稱<input required value={form.displayName} onChange={(event) => setForm((previous) => ({ ...previous, displayName: event.target.value }))} placeholder="例如：小芸" className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#58534C]">帳號角色<select value={form.role} onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value as "admin" | "staff" }))} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none"><option value="staff">員工</option><option value="admin">系統管理員</option></select></label><label className="text-sm font-semibold text-[#58534C]">Email<input required type="email" value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} placeholder="name@example.com" className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#58534C]">初始密碼<input required minLength={8} type="password" value={form.password} onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))} placeholder="至少 8 碼" className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label></div><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Secondary onClick={() => setShowForm(false)}>取消</Secondary><Primary type="submit" disabled={creating}>{creating ? "建立中…" : "建立帳號"}</Primary></div></form>}

          {!isAdmin ? <div className="mt-5 rounded-xl bg-[#F8F6F2] p-4 text-sm leading-6 text-[#766F66]">你目前是員工帳號，無法建立或變更其他帳號的權限。請聯繫系統管理員協助處理。</div> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-4 py-3">帳號</th><th className="px-3 py-3">Email</th><th className="px-3 py-3">角色</th><th className="px-4 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{loading ? <tr><td colSpan={4} className="px-4 py-7 text-center text-[#8F887F]">載入帳號中…</td></tr> : users.map((user) => <tr key={user.id}><td className="px-4 py-4"><b className="block text-[#4A4640]">{user.display_name || "未命名帳號"}{user.id === currentUser.id && <small className="ml-2 text-xs font-normal text-[#8F887F]">目前登入</small>}</b></td><td className="px-3 py-4 text-[#706A61]">{user.email}</td><td className="px-3 py-4"><select aria-label={`${user.display_name || user.email} 的角色`} value={user.role} onChange={(event) => updateRole(user, event.target.value as "admin" | "staff")} className="h-9 rounded-lg border border-[#E5E1DB] bg-white px-2 text-xs font-semibold text-[#58544D] outline-none"><option value="admin">系統管理員</option><option value="staff">員工</option></select></td><td className="px-4 py-4 text-right"><button disabled={user.id === currentUser.id} onClick={() => removeUser(user)} className="text-sm font-semibold text-[#A35F37] disabled:cursor-not-allowed disabled:opacity-35">刪除</button></td></tr>)}</tbody></table></div>}
        </Card>
      </div>
      <aside className="h-fit space-y-5 xl:sticky xl:top-6">
        <Card className="p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CURRENT ACCOUNT</p><h2 className="mt-2 text-lg font-semibold">目前登入帳號</h2><div className="mt-5 rounded-xl bg-[#F8F6F2] p-4"><p className="text-xs font-semibold text-[#8A8379]">顯示名稱</p><p className="mt-1 text-sm font-semibold">{currentUser.displayName}</p><p className="mt-4 text-xs font-semibold text-[#8A8379]">Email</p><p className="mt-1 break-all text-sm font-semibold">{currentUser.email}</p><p className="mt-4 text-xs font-semibold text-[#8A8379]">角色</p><Pill tone={isAdmin ? "green" : "stone"}>{isAdmin ? "系統管理員" : "員工"}</Pill></div></Card>
        <Card className="p-5"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PERMISSIONS</p><h2 className="mt-2 text-lg font-semibold">權限說明</h2><ul className="mt-4 space-y-3 text-sm leading-6 text-[#756F66]"><li>系統管理員：管理帳號與角色。</li><li>員工：可登入與使用日常後台功能。</li><li>帳號異動會立即套用至下一次操作。</li></ul></Card>
      </aside>
    </div>
  </>;
}

function LegacyNewPurchase({ back }: { back: () => void }) {
  const [supplier, setSupplier] = useState("Seoul Daily");
  const [quantities, setQuantities] = useState<Record<number, number>>({ 1: 12, 3: 20 });
  const [submitted, setSubmitted] = useState(false);
  const selected = products.filter((product) => quantities[product.id] > 0);
  const total = selected.reduce((sum, product) => sum + product.cost * quantities[product.id], 0);
  const updateQuantity = (id: number, value: string) => setQuantities((previous) => ({ ...previous, [id]: Math.max(0, Number(value) || 0) }));

  return <><Header eyebrow="NEW PURCHASE ORDER" title="建立採購單" description="建立供應商、商品與預計收貨資料。"><Secondary onClick={back}>← 返回採購與供應商</Secondary></Header>{submitted && <Card className="mb-5 border-[#D9E5DB] bg-[#EEF5EF] p-5"><b className="block text-[#34563D]">採購單已建立</b><small className="mt-1 block text-sm text-[#57735D]">採購單 #PO-260721-05 已儲存，等待供應商確認。</small></Card>}<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><div className="space-y-5"><Card className="p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PURCHASE INFORMATION</p><h2 className="mt-2 text-xl font-semibold">採購資訊</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#575149]">採購單編號<input defaultValue="#PO-260721-05" className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#575149]">預計到貨日期<input type="date" defaultValue="2026-07-28" className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#575149]">供應商<select value={supplier} onChange={(event) => setSupplier(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"><option>Seoul Daily</option><option>Mori Select</option><option>Atelier Home</option></select></label><label className="text-sm font-semibold text-[#575149]">付款條件<select className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"><option>貨到付款</option><option>預付訂金</option><option>月結 30 天</option></select></label></div></Card><Card className="overflow-hidden"><div className="border-b border-[#F0EDE8] p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">ITEMS</p><h2 className="mt-2 text-xl font-semibold">採購商品</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">商品</th><th className="px-3 py-3">商品種類</th><th className="px-3 py-3">採購成本</th><th className="px-3 py-3">數量</th><th className="px-6 py-3 text-right">小計</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{products.slice(0, 3).map((product) => <tr key={product.id}><td className="px-6 py-4"><b className="block text-[#4A4640]">{product.name}</b><small className="mt-1 block text-xs text-[#938D84]">{product.specification}</small></td><td className="px-3 py-4 text-[#726C63]">{product.country} · {product.category}</td><td className="px-3 py-4">{currency(product.cost)}</td><td className="px-3 py-4"><input type="number" min="0" value={quantities[product.id] ?? 0} onChange={(event) => updateQuantity(product.id, event.target.value)} className="h-9 w-20 rounded-lg border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm outline-none" /></td><td className="px-6 py-4 text-right font-semibold">{currency(product.cost * (quantities[product.id] ?? 0))}</td></tr>)}</tbody></table></div></Card></div><aside className="h-fit rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PURCHASE SUMMARY</p><h2 className="mt-2 text-xl font-semibold">採購摘要</h2><p className="mt-2 text-sm text-[#807A72]">供應商：{supplier}</p><div className="mt-5 space-y-3 border-y border-[#F0EDE8] py-5">{selected.map((product) => <div key={product.id} className="flex justify-between gap-3 text-sm"><span className="min-w-0"><b className="block truncate">{product.name}</b><small className="mt-1 block text-xs text-[#938D84]">× {quantities[product.id]}</small></span><b className="shrink-0">{currency(product.cost * quantities[product.id])}</b></div>)}</div><div className="mt-5 flex justify-between text-base font-semibold"><span>預計採購總額</span><b>{currency(total)}</b></div><Primary onClick={() => setSubmitted(true)} className="mt-6 w-full">建立採購單</Primary></aside></div></>;
}

function InventoryManagement({ go }: { go: (view: View) => void }) {
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadAdjustments = async () => {
      try {
        const response = await fetch("/api/inventory/adjustments");
        const result = await response.json();
        if (response.ok && active) setAdjustments(result.adjustments ?? []);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadAdjustments();
    return () => { active = false; };
  }, []);

  return <><Header eyebrow="INVENTORY OPERATIONS" title="庫存管理" description="所有手動調整、訂單扣庫存與採購收貨都會寫入資料庫並保留紀錄。"><Secondary onClick={() => go("stock")}>查看庫存總覽</Secondary><Primary onClick={() => go("stock")}>＋ 調整庫存</Primary></Header><div className="grid gap-4 md:grid-cols-3">{[["庫存調整", "新增或扣除可售庫存，必須填寫異動原因。", "＋ 新增調整"], ["採購收貨", "從採購單逐筆收貨，系統會自動增加可售庫存。", "處理收貨"], ["完整紀錄", "每一次異動都保留數量、原因與操作人員。", "查看紀錄"]].map(([title, description, action], index) => <Card key={title} className="p-5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0F4EF] text-[11px] font-bold text-[#58715E]">0{index + 1}</span><h2 className="mt-5 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#817B72]">{description}</p><button onClick={() => go(index === 1 ? "purchases" : "stock")} className="mt-6 text-sm font-semibold text-[#5E7665]">{action} →</button></Card>)}</div><Card className="mt-5 overflow-hidden"><div className="flex items-center justify-between p-5 sm:p-6"><div><h2 className="font-semibold">近期庫存異動</h2><p className="mt-1 text-sm text-[#898379]">最近 50 筆已完成的資料庫紀錄。</p></div><button onClick={() => go("stock")} className="text-sm font-semibold text-[#5E7665]">調整庫存 →</button></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">時間</th><th className="px-3 py-3">商品</th><th className="px-3 py-3">異動原因</th><th className="px-3 py-3">數量</th><th className="px-3 py-3">備註</th><th className="px-6 py-3">操作人員</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{loading ? <tr><td colSpan={6} className="px-6 py-10 text-center text-[#8D877E]">載入庫存異動中…</td></tr> : adjustments.length ? adjustments.map((adjustment) => <tr key={adjustment.id}><td className="px-6 py-4 text-xs text-[#8D877E]">{new Date(adjustment.created_at).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td className="px-3 py-4"><b className="block text-[#4F4A43]">{adjustment.products?.name ?? "已刪除商品"}</b><small className="block pt-1 font-mono text-[10px] text-[#938D84]">{adjustment.products?.sku ?? "—"}</small></td><td className="px-3 py-4"><Pill tone={adjustment.reason === "損壞報廢" ? "orange" : adjustment.reason === "採購收貨" ? "green" : "stone"}>{adjustment.reason}</Pill></td><td className={`px-3 py-4 font-semibold ${adjustment.quantity_change > 0 ? "text-[#45634C]" : "text-[#A35F37]"}`}>{adjustment.quantity_change > 0 ? "+" : ""}{adjustment.quantity_change}</td><td className="px-3 py-4 text-[#706A61]">{adjustment.note || "—"}</td><td className="px-6 py-4 text-[#8D877E]">{adjustment.performed_by || "—"}</td></tr>) : <tr><td colSpan={6} className="px-6 py-10 text-center text-[#8D877E]">尚無庫存異動紀錄。</td></tr>}</tbody></table></div></Card></>;
}

function StockOverview({ catalog, stock, openProduct, saveAdjustment }: { catalog: Product[]; stock: Record<string, number>; openProduct: (product: Product) => void; saveAdjustment: (productId: string, quantity: number, reason: string, note: string) => Promise<void> }) {
  const [countryFilter, setCountryFilter] = useState("全部國家");
  const [categoryFilter, setCategoryFilter] = useState("全部商品種類");
  const [statusFilter, setStatusFilter] = useState("全部狀態");
  const [query, setQuery] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustmentProductId, setAdjustmentProductId] = useState("");
  const [adjustment, setAdjustment] = useState("0");
  const [adjustmentReason, setAdjustmentReason] = useState("盤點差異");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const countries = Object.keys(productCategoriesByCountry);
  const categoryOptions = countryFilter === "全部國家" ? Array.from(new Set(catalog.map((product) => product.category))) : productCategoriesByCountry[countryFilter] ?? [];
  const stockValue = (product: Product) => stock[String(product.id)] ?? product.available;
  const visibleProducts = catalog.filter((product) => {
    const lowStock = stockValue(product) <= product.safety;
    const matchesQuery = !query.trim() || [product.name, product.sku, product.country, product.category].join(" ").toLowerCase().includes(query.trim().toLowerCase());
    return (countryFilter === "全部國家" || product.country === countryFilter) && (categoryFilter === "全部商品種類" || product.category === categoryFilter) && (statusFilter === "全部狀態" || (statusFilter === "低庫存" ? lowStock : !lowStock)) && matchesQuery;
  });
  const selectedProduct = catalog.find((product) => String(product.id) === adjustmentProductId) ?? catalog[0];
  const adjustmentQuantity = Number(adjustment) || 0;
  const selectedAvailable = selectedProduct ? stockValue(selectedProduct) : 0;
  const canApplyAdjustment = Boolean(selectedProduct) && adjustmentQuantity !== 0 && selectedAvailable + adjustmentQuantity >= 0;
  const actualTotal = catalog.reduce((total, product) => total + stockValue(product) + product.reserved, 0);
  const availableTotal = catalog.reduce((total, product) => total + stockValue(product), 0);
  const reservedTotal = catalog.reduce((total, product) => total + product.reserved, 0);
  const lowStockCount = catalog.filter((product) => stockValue(product) <= product.safety).length;
  const selectClass = "h-9 w-full rounded-xl border border-[#E5E1DB] bg-white px-3 text-xs font-semibold text-[#58544D] outline-none";
  const openAdjustment = () => {
    if (!catalog.length) { setNotice("請先在商品資料庫建立商品，才能調整庫存。"); return; }
    setAdjustmentProductId(String(visibleProducts[0]?.id ?? catalog[0].id));
    setAdjustment("0");
    setAdjustmentNote("");
    setError("");
    setAdjusting(true);
  };
  const submitAdjustment = async () => {
    if (!selectedProduct || !canApplyAdjustment) return;
    setSaving(true);
    setError("");
    try {
      await saveAdjustment(String(selectedProduct.id), adjustmentQuantity, adjustmentReason, adjustmentNote);
      setNotice(`${selectedProduct.name} 已${adjustmentQuantity > 0 ? "增加" : "扣除"} ${Math.abs(adjustmentQuantity)} 件，並已寫入資料庫。`);
      setAdjusting(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法儲存庫存調整。");
    } finally {
      setSaving(false);
    }
  };
  const exportStock = () => {
    const header = ["商品編號", "商品名稱", "國家", "商品種類", "實際在庫", "已保留", "可售庫存", "到貨中", "安全庫存"];
    const rows = catalog.map((product) => [product.sku, product.name, product.country, product.category, stockValue(product) + product.reserved, product.reserved, stockValue(product), product.incoming, product.safety]);
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "wobuy174_庫存總覽.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return <><Header eyebrow="STOCK OVERVIEW" title="庫存總覽" description="以單一商品為單位，查看可售、保留與到貨中的即時資料庫庫存。"><Secondary onClick={exportStock}>匯出庫存</Secondary><Primary onClick={openAdjustment}>＋ 調整庫存</Primary></Header><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="實際在庫總量" value={`${actualTotal.toLocaleString("zh-TW")} 件`} note="可售與已保留庫存合計" /><Metric label="可售庫存總量" value={`${availableTotal.toLocaleString("zh-TW")} 件`} note="可立即建立新訂單" accent /><Metric label="已保留庫存" value={`${reservedTotal.toLocaleString("zh-TW")} 件`} note="已確認訂單所占用" /><Metric label="低庫存品項" value={`${String(lowStockCount).padStart(2, "0")} 項`} note="低於設定的安全庫存" /></section>{notice && <div role="status" className="mt-4 flex items-center justify-between rounded-xl border border-[#D9E5DB] bg-[#EEF5EF] px-4 py-3 text-sm font-semibold text-[#4D7054]"><span>{notice}</span><button aria-label="關閉提示" onClick={() => setNotice("")} className="text-[#5D7B63]">×</button></div>}<Card className="mt-5 overflow-hidden"><div className="flex flex-col gap-3 border-b border-[#F0EDE8] p-5 sm:p-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><Search value={query} onChange={setQuery} placeholder="搜尋商品名稱、商品編號或庫位" /><span className="text-xs text-[#807A71]">顯示 {visibleProducts.length} 項商品</span></div><div className="grid w-full gap-2 sm:max-w-[497px] sm:grid-cols-3"><select aria-label="國家篩選" value={countryFilter} onChange={(event) => { setCountryFilter(event.target.value); setCategoryFilter("全部商品種類"); }} className={selectClass}><option>全部國家</option>{countries.map((country) => <option key={country}>{country}</option>)}</select><select aria-label="商品種類篩選" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={selectClass}><option>全部商品種類</option>{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select><select aria-label="庫存狀態篩選" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={selectClass}><option>全部狀態</option><option>正常庫存</option><option>低庫存</option></select></div></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">商品</th><th className="px-3 py-3">商品編號</th><th className="px-3 py-3">實際在庫</th><th className="px-3 py-3">已保留</th><th className="px-3 py-3">可售庫存</th><th className="px-3 py-3">到貨中</th><th className="px-3 py-3">安全庫存</th><th className="px-6 py-3 text-right">商品頁面</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{visibleProducts.length ? visibleProducts.map((product) => { const available = stockValue(product); return <tr key={product.id} className="hover:bg-[#FCFBF9]"><td className="px-6 py-4"><button onClick={() => openProduct(product)} className="flex items-center gap-3 text-left"><ProductTile product={product} small /><span><b className="block text-[#4A4640]">{product.name}</b><small className="block pt-1 text-xs text-[#938D84]">{product.specification}</small></span></button></td><td className="px-3 py-4 font-mono text-xs text-[#6E695F]">{product.sku}</td><td className="px-3 py-4">{available + product.reserved}</td><td className="px-3 py-4">{product.reserved}</td><td className={`px-3 py-4 font-bold ${available <= product.safety ? "text-[#A66932]" : "text-[#45634C]"}`}>{available}</td><td className="px-3 py-4">{product.incoming || "—"}</td><td className="px-3 py-4">{product.safety}</td><td className="px-6 py-4 text-right"><button onClick={() => openProduct(product)} className="text-sm font-semibold text-[#5E7665]">查看商品 →</button></td></tr>; }) : <tr><td colSpan={8} className="px-6 py-10 text-center text-[#8D877E]">尚無資料庫商品。請先於商品資料庫新增或匯入商品。</td></tr>}</tbody></table></div></Card>{adjusting && <div className="fixed inset-0 z-50 flex items-end bg-[#292824]/35 sm:items-center sm:justify-center sm:p-6"><div role="dialog" aria-modal="true" aria-labelledby="adjust-stock-title" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">STOCK ADJUSTMENT</p><h2 id="adjust-stock-title" className="mt-2 text-xl font-semibold">調整庫存</h2><p className="mt-2 text-sm leading-6 text-[#7D776E]">儲存後會立即更新可售庫存並保留異動紀錄。</p></div><button aria-label="關閉調整庫存" onClick={() => setAdjusting(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg text-[#777168]">×</button></div><div className="mt-6 grid gap-4"><label className="text-sm font-semibold text-[#575149]">商品<select value={adjustmentProductId} onChange={(event) => setAdjustmentProductId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E5E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none">{catalog.map((product) => <option key={product.id} value={String(product.id)}>{product.country} · {product.category}｜{product.name}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#575149]">異動數量<input type="number" inputMode="numeric" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E5E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#575149]">異動原因<select value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E5E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"><option>盤點差異</option><option>採購入庫</option><option>損壞報廢</option><option>樣品領用</option><option>其他調整</option></select></label></div><label className="text-sm font-semibold text-[#575149]">備註<input value={adjustmentNote} onChange={(event) => setAdjustmentNote(event.target.value)} placeholder="例如：7 月庫存盤點差異" className="mt-2 h-11 w-full rounded-xl border border-[#E5E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none" /></label><div className="rounded-xl bg-[#F8F6F2] p-4 text-sm"><div className="flex justify-between"><span className="text-[#787168]">目前可售庫存</span><b>{selectedAvailable} 件</b></div><div className="mt-2 flex justify-between"><span className="text-[#787168]">調整後可售庫存</span><b className={canApplyAdjustment ? "text-[#45634C]" : "text-[#A66932]"}>{selectedAvailable + adjustmentQuantity} 件</b></div>{adjustmentQuantity < 0 && !canApplyAdjustment && <p className="mt-3 text-xs text-[#A66932]">扣除數量不可超過目前可售庫存。</p>}</div>{error && <p className="text-sm font-semibold text-[#A35F37]">{error}</p>}</div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Secondary onClick={() => setAdjusting(false)} disabled={saving}>取消</Secondary><Primary onClick={() => { void submitAdjustment(); }} disabled={!canApplyAdjustment || saving}>{saving ? "儲存中…" : "儲存調整"}</Primary></div></div></div>}</>;
}

function PurchasesPage({ go, onInventoryChanged }: { go: (view: View) => void; onInventoryChanged: () => Promise<void> }) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<PurchaseOrder | null>(null);
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadPurchaseOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/purchase-orders");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法讀取採購單。");
      setPurchaseOrders(result.purchaseOrders ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法讀取採購單。");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void loadPurchaseOrders(); }, []);
  const openReceipt = (purchaseOrder: PurchaseOrder) => {
    setReceipt(purchaseOrder);
    setReceiptQuantities(Object.fromEntries(purchaseOrder.purchase_order_items.map((item) => [item.id, "0"])));
    setError("");
  };
  const saveReceipt = async () => {
    if (!receipt) return;
    const items = receipt.purchase_order_items.map((item) => ({ itemId: item.id, quantity: Number(receiptQuantities[item.id]) || 0 })).filter((item) => item.quantity > 0);
    if (!items.length) { setError("請至少填寫一項收貨數量。"); return; }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/purchase-orders/${receipt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "receive", items }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法完成收貨。");
      setPurchaseOrders((previous) => previous.map((item) => item.id === receipt.id ? result.purchaseOrder : item));
      setReceipt(null);
      await onInventoryChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法完成收貨。");
    } finally {
      setSaving(false);
    }
  };
  const toneFor = (status: PurchaseOrder["status"]): Tone => status === "已完成" ? "green" : status === "部分收貨" ? "orange" : status === "已取消" ? "stone" : "blue";
  const formatDate = (value: string | null) => value ? value.replaceAll("-", "/") : "未設定";
  return <><Header eyebrow="PURCHASING" title="採購與供應商" description="建立採購單後列入到貨中；收貨入庫會同步增加商品可售庫存。"><Primary onClick={() => go("newPurchase")}>＋ 建立採購單</Primary></Header>{error && !receipt && <Card className="mb-5 border-[#F0D6C2] bg-[#FFF7F0] p-4 text-sm font-semibold text-[#9B562A]">{error}</Card>}<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-[#F0EDE8] p-5 sm:p-6"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PURCHASE ORDERS</p><h2 className="mt-2 text-xl font-semibold">採購單與收貨作業</h2></div><button onClick={() => { void loadPurchaseOrders(); }} className="text-sm font-semibold text-[#5E7665]">重新整理</button></div><div className="divide-y divide-[#F0EDE8]">{loading ? <p className="p-6 text-sm text-[#8D877E]">載入採購單中…</p> : purchaseOrders.length ? purchaseOrders.map((purchaseOrder) => <article key={purchaseOrder.id} className="p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><b className="text-base text-[#403C36]">{purchaseOrder.purchase_number}</b><Pill tone={toneFor(purchaseOrder.status)}>{purchaseOrder.status}</Pill></div><p className="mt-2 text-sm font-semibold text-[#5A554D]">{purchaseOrder.supplier_name}</p><p className="mt-1 text-xs text-[#938D84]">預計到貨 {formatDate(purchaseOrder.expected_arrival_date)} · {purchaseOrder.payment_terms || "未設定付款條件"}</p></div><div className="flex items-center gap-3 sm:text-right"><span className="text-sm font-semibold">{currency(purchaseOrder.total)}</span>{purchaseOrder.status !== "已完成" && purchaseOrder.status !== "已取消" && <Secondary onClick={() => openReceipt(purchaseOrder)}>收貨入庫</Secondary>}</div></div><div className="mt-4 rounded-xl bg-[#F8F6F2] px-4 py-3 text-xs text-[#706A61]">{purchaseOrder.purchase_order_items.map((item) => `${item.product_name} 已收 ${item.received_quantity}/${item.quantity}`).join("　")}</div></article>) : <p className="p-8 text-center text-sm text-[#8D877E]">尚無採購單。請先建立第一張採購單。</p>}</div></Card><Card className="h-fit p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">SUPPLIERS</p><h2 className="mt-2 text-xl font-semibold">供應商管理</h2><p className="mt-2 text-sm leading-6 text-[#898379]">先建立供應商，再建立對應的採購單；供應商與採購資料會保留在資料庫。</p><Secondary onClick={() => go("suppliers")} className="mt-6 w-full">管理供應商</Secondary></Card></div>{receipt && <div className="fixed inset-0 z-50 flex items-end bg-[#292824]/35 sm:items-center sm:justify-center sm:p-6"><div role="dialog" aria-modal="true" aria-labelledby="receipt-title" className="w-full max-w-2xl rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">RECEIVE PURCHASE ORDER</p><h2 id="receipt-title" className="mt-2 text-xl font-semibold">收貨入庫</h2><p className="mt-2 text-sm leading-6 text-[#7D776E]">{receipt.purchase_number} · 請填寫本次實際收貨數量。儲存後可售庫存會立即增加。</p></div><button aria-label="關閉收貨視窗" onClick={() => setReceipt(null)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E7E2DB] text-lg text-[#777168]">×</button></div><div className="mt-6 divide-y divide-[#F0EDE8] rounded-xl border border-[#ECE8E2]">{receipt.purchase_order_items.map((item) => { const remaining = item.quantity - item.received_quantity; return <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_120px]"><div><b className="block text-sm">{item.product_name}</b><p className="mt-1 text-xs text-[#8D877E]">訂購 {item.quantity} · 已收 {item.received_quantity} · 尚可收 {remaining}</p></div><label className="text-xs font-semibold text-[#7C766D]">本次收貨<input type="number" min="0" max={remaining} value={receiptQuantities[item.id] ?? "0"} onChange={(event) => setReceiptQuantities((previous) => ({ ...previous, [item.id]: event.target.value }))} disabled={remaining === 0} className="mt-1 h-10 w-full rounded-lg border border-[#E5E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none disabled:opacity-40" /></label></div>; })}</div>{error && <p className="mt-4 text-sm font-semibold text-[#A35F37]">{error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Secondary onClick={() => setReceipt(null)} disabled={saving}>取消</Secondary><Primary onClick={() => { void saveReceipt(); }} disabled={saving}>{saving ? "收貨中…" : "確認收貨並入庫"}</Primary></div></div></div>}</>;
}

function NewPurchase({ catalog, back, openSuppliers, onCreated }: { catalog: Product[]; back: () => void; openSuppliers: () => void; onCreated: () => Promise<void> }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [unitCosts, setUnitCosts] = useState<Record<string, number>>({});
  const [purchaseNumber, setPurchaseNumber] = useState("產生中…");
  const [expectedArrivalDate, setExpectedArrivalDate] = useState(taipeiToday);
  const [paymentTerms, setPaymentTerms] = useState("貨到付款");
  const [submitted, setSubmitted] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setUnitCosts((previous) => ({ ...Object.fromEntries(catalog.map((product) => [String(product.id), product.cost])), ...previous })); }, [catalog]);
  useEffect(() => {
    let active = true;
    const loadFormData = async () => {
      try {
        const [supplierResponse, numberResponse] = await Promise.all([fetch("/api/suppliers"), fetch(`/api/purchase-orders?nextFor=${taipeiToday()}`)]);
        const supplierResult = await supplierResponse.json();
        const numberResult = await numberResponse.json();
        if (active && supplierResponse.ok) { setSuppliers(supplierResult.suppliers ?? []); setSupplierId(supplierResult.suppliers?.[0]?.id ?? ""); }
        if (active && numberResponse.ok) setPurchaseNumber(numberResult.purchaseNumber ?? "自動產生");
      } catch {
        if (active) setError("無法載入供應商或採購單編號。請稍後再試。");
      }
    };
    void loadFormData();
    return () => { active = false; };
  }, []);
  const selected = catalog.filter((product) => (quantities[String(product.id)] ?? 0) > 0);
  const total = selected.reduce((sum, product) => sum + (unitCosts[String(product.id)] ?? product.cost) * (quantities[String(product.id)] ?? 0), 0);
  const updateQuantity = (id: string, value: string) => setQuantities((previous) => ({ ...previous, [id]: Math.max(0, Number(value) || 0) }));
  const createPurchaseOrder = async () => {
    if (!selected.length) { setError("請至少填寫一項商品的採購數量。"); return; }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/purchase-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseNumber: purchaseNumber.startsWith("PO-") ? purchaseNumber : "", supplierId, expectedArrivalDate, paymentTerms, items: selected.map((product) => ({ productId: String(product.id), unitCost: unitCosts[String(product.id)] ?? product.cost, quantity: quantities[String(product.id)] })) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法建立採購單。");
      setSubmitted(result.purchaseOrder);
      await onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法建立採購單。");
    } finally {
      setSaving(false);
    }
  };
  return <><Header eyebrow="NEW PURCHASE ORDER" title="建立採購單" description="建立後會列入到貨中；完成收貨時才會增加可售庫存。"><Secondary onClick={back}>← 返回採購與供應商</Secondary></Header>{submitted && <Card className="mb-5 border-[#D9E5DB] bg-[#EEF5EF] p-5"><b className="block text-[#34563D]">採購單已建立</b><small className="mt-1 block text-sm text-[#57735D]">採購單 {submitted.purchase_number} 已寫入資料庫，商品數量已列入到貨中。</small></Card>}{error && <Card className="mb-5 border-[#F0D6C2] bg-[#FFF7F0] p-5 text-sm font-semibold text-[#9B562A]">{error}</Card>}<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><div className="space-y-5"><Card className="p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PURCHASE INFORMATION</p><h2 className="mt-2 text-xl font-semibold">採購資訊</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#575149]">採購單編號<input value={purchaseNumber} readOnly className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#F4F1EC] px-3 text-sm font-normal text-[#756F66] outline-none" /></label><label className="text-sm font-semibold text-[#575149]">預計到貨日期<input type="date" value={expectedArrivalDate} onChange={(event) => setExpectedArrivalDate(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#575149]">供應商<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"><option value="">請選擇供應商</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} · {supplier.country}</option>)}</select>{!suppliers.length && <button onClick={openSuppliers} className="mt-2 text-xs font-semibold text-[#5E7665]">＋ 先建立供應商</button>}</label><label className="text-sm font-semibold text-[#575149]">付款條件<input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} placeholder="例如：貨到付款、月結 30 天" className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none" /></label></div></Card><Card className="overflow-hidden"><div className="border-b border-[#F0EDE8] p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">ITEMS</p><h2 className="mt-2 text-xl font-semibold">採購商品</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead className="bg-[#FBFAF8] text-[11px] font-semibold tracking-wide text-[#928C83]"><tr><th className="px-6 py-3">商品</th><th className="px-3 py-3">商品種類</th><th className="px-3 py-3">採購成本</th><th className="px-3 py-3">數量</th><th className="px-6 py-3 text-right">小計</th></tr></thead><tbody className="divide-y divide-[#F0EDE8] text-sm">{catalog.length ? catalog.map((product) => { const id = String(product.id); const unitCost = unitCosts[id] ?? product.cost; const quantity = quantities[id] ?? 0; return <tr key={id}><td className="px-6 py-4"><b className="block text-[#4A4640]">{product.name}</b><small className="mt-1 block text-xs text-[#938D84]">{product.specification}</small></td><td className="px-3 py-4 text-[#726C63]">{product.country} · {product.category}</td><td className="px-3 py-4"><input type="number" min="0" value={unitCost} onChange={(event) => setUnitCosts((previous) => ({ ...previous, [id]: Math.max(0, Number(event.target.value) || 0) }))} className="h-9 w-24 rounded-lg border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm outline-none" /></td><td className="px-3 py-4"><input type="number" min="0" value={quantity} onChange={(event) => updateQuantity(id, event.target.value)} className="h-9 w-20 rounded-lg border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm outline-none" /></td><td className="px-6 py-4 text-right font-semibold">{currency(unitCost * quantity)}</td></tr>; }) : <tr><td colSpan={5} className="px-6 py-10 text-center text-[#8D877E]">尚無資料庫商品，請先建立或匯入商品。</td></tr>}</tbody></table></div></Card></div><aside className="h-fit rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PURCHASE SUMMARY</p><h2 className="mt-2 text-xl font-semibold">採購摘要</h2><p className="mt-2 text-sm text-[#807A72]">供應商：{suppliers.find((supplier) => supplier.id === supplierId)?.name ?? "尚未選擇"}</p><div className="mt-5 space-y-3 border-y border-[#F0EDE8] py-5">{selected.length ? selected.map((product) => <div key={product.id} className="flex justify-between gap-3 text-sm"><span className="min-w-0"><b className="block truncate">{product.name}</b><small className="mt-1 block text-xs text-[#938D84]">× {quantities[String(product.id)]}</small></span><b className="shrink-0">{currency((unitCosts[String(product.id)] ?? product.cost) * (quantities[String(product.id)] ?? 0))}</b></div>) : <p className="text-sm text-[#938D84]">尚未選擇採購商品。</p>}</div><div className="mt-5 flex justify-between text-base font-semibold"><span>預計採購總額</span><b>{currency(total)}</b></div><Primary onClick={() => { void createPurchaseOrder(); }} disabled={saving || !supplierId || !selected.length} className="mt-6 w-full">{saving ? "建立中…" : "建立採購單"}</Primary></aside></div></>;
}

function CreateOrder({ catalog, stock, confirmOrder, back, openCustomers }: { catalog: Product[]; stock: Record<string, number>; confirmOrder: (lines: Record<string, number>) => void; back: () => void; openCustomers: () => void }) {
  const storedProducts = catalog.filter((product) => typeof product.id === "string");
  const [lines, setLines] = useState<Record<string, number>>(() => Object.fromEntries(storedProducts.slice(0, 2).map((product) => [String(product.id), 1])));
  const [orderMethod, setOrderMethod] = useState<"social" | "staff">("social");
  const [linePrices, setLinePrices] = useState<Record<string, number>>(() => Object.fromEntries(storedProducts.map((product) => [String(product.id), product.retailPrice])));
  const [addProductId, setAddProductId] = useState(String(storedProducts[2]?.id ?? storedProducts[0]?.id ?? ""));
  const [orderDate, setOrderDate] = useState(taipeiToday);
  const [orderNumber, setOrderNumber] = useState(() => firstOrderNumberForDate(taipeiToday()));
  const [status, setStatus] = useState("待確認");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState("銀行轉帳");
  const [reconciliation, setReconciliation] = useState("待查帳");
  const [delivery, setDelivery] = useState<"pickup" | "myship">("myship");
  const [modal, setModal] = useState<"confirm" | "deduct" | null>(null);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [stockDeducted, setStockDeducted] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [customerFields, setCustomerFields] = useState<Array<[string, string]>>([[
    "客戶姓名", "尚未選擇"], ["LINE@名稱", "—"], ["電話", "—"], ["地址", "—"],
  ]);
  const [newCustomer, setNewCustomer] = useState({ name: "", lineName: "", phone: "", address: "" });
  const stockFor = (product: Product) => stock[String(product.id)] ?? product.available;
  const selected = storedProducts.filter((product) => lines[String(product.id)]);
  const subtotal = useMemo(() => selected.reduce((sum, product) => sum + (linePrices[String(product.id)] ?? product.retailPrice) * lines[String(product.id)], 0), [selected, linePrices, lines]);
  const costTotal = useMemo(() => selected.reduce((sum, product) => sum + product.cost * lines[String(product.id)], 0), [selected, lines]);
  const shipping = delivery === "pickup" || subtotal >= 2500 ? 0 : 38;
  const total = subtotal + shipping;
  const netProfit = total - costTotal;
  const availableProducts = storedProducts.filter((product) => !lines[String(product.id)] && stockFor(product) > 0);

  useEffect(() => {
    let active = true;
    const loadCustomers = async () => {
      try {
        const response = await fetch("/api/customers");
        const result = await response.json();
        if (response.ok && active) setCustomers(result.customers ?? []);
      } catch {
        if (active) setCustomerError("無法讀取客戶資料。請重新整理後再試。");
      }
    };
    void loadCustomers();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storedProducts.length) return;
    setLines((previous) => Object.keys(previous).length ? previous : Object.fromEntries(storedProducts.slice(0, 2).map((product) => [String(product.id), 1])));
    setLinePrices((previous) => Object.keys(previous).length ? previous : Object.fromEntries(storedProducts.map((product) => [String(product.id), product.retailPrice])));
    setAddProductId((previous) => previous || String(storedProducts[2]?.id ?? storedProducts[0]?.id ?? ""));
  }, [storedProducts]);

  useEffect(() => {
    let active = true;
    const loadOrderNumber = async () => {
      try {
        const response = await fetch(`/api/orders?nextFor=${orderDate}`);
        const result = await response.json();
        if (response.ok && active && result.orderNumber) setOrderNumber(result.orderNumber);
      } catch {
        // 資料庫暫時無法連線時，保留日期加 001 的預設編號。
      }
    };
    void loadOrderNumber();
    return () => { active = false; };
  }, [orderDate]);

  const updateQuantity = (id: string, change: number) => setLines((previous) => {
    const nextQuantity = (previous[id] ?? 0) + change;
    const next = { ...previous };
    if (nextQuantity <= 0) delete next[id];
    else {
      const product = storedProducts.find((item) => String(item.id) === id);
      next[id] = Math.min(product ? stockFor(product) : 0, nextQuantity);
    }
    return next;
  });
  const changeOrderMethod = (nextMethod: "social" | "staff") => {
    setOrderMethod(nextMethod);
    setLinePrices(Object.fromEntries(storedProducts.map((product) => [String(product.id), nextMethod === "social" ? product.retailPrice : product.staffPrice])));
  };
  const addProduct = () => {
    const id = addProductId;
    const product = storedProducts.find((item) => String(item.id) === id);
    if (!product || lines[id] || stockFor(product) <= 0) return;
    setLines((previous) => ({ ...previous, [id]: 1 }));
  };
  const changeOrderDate = (nextDate: string) => {
    setOrderDate(nextDate);
    setOrderNumber(firstOrderNumberForDate(nextDate));
  };
  const chooseCustomer = (id: string) => {
    setSelectedCustomerId(id);
    const customer = customers.find((item) => item.id === id);
    if (!customer) return;
    setCustomerFields([
      ["客戶姓名", customer.name],
      ["LINE@名稱", customer.line_name || "—"],
      ["電話", customer.phone || "—"],
      ["地址", customer.address || "—"],
    ]);
  };
  const saveNewCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingCustomer(true);
    setCustomerError("");
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomer),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法新增客戶。請稍後再試。");
      const customer = result.customer as Customer;
      setCustomers((previous) => [customer, ...previous]);
      setSelectedCustomerId(customer.id);
      setCustomerFields([
        ["客戶姓名", customer.name],
        ["LINE@名稱", customer.line_name || "—"],
        ["電話", customer.phone || "—"],
        ["地址", customer.address || "—"],
      ]);
      setNewCustomer({ name: "", lineName: "", phone: "", address: "" });
      setShowNewCustomer(false);
    } catch (reason) {
      setCustomerError(reason instanceof Error ? reason.message : "無法新增客戶。請稍後再試。");
    } finally {
      setSavingCustomer(false);
    }
  };
  const confirmOrderAction = async () => {
    if (!selectedCustomerId) {
      setOrderError("請先選擇或新增客戶，再確認訂單。");
      setModal(null);
      return;
    }
    setSavingOrder(true);
    setOrderError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber,
          customerId: selectedCustomerId,
          orderDate,
          status: "已確認",
          orderMethod: orderMethod === "social" ? "社群下單" : "員工下單",
          paymentMethod: payment,
          reconciliationStatus: reconciliation,
          deliveryMethod: delivery === "pickup" ? "門市自取" : "賣貨便",
          note,
          items: selected.map((product) => ({
            productId: typeof product.id === "string" ? product.id : "",
            productName: product.name,
            category: product.category,
            unitPrice: linePrices[String(product.id)] ?? product.retailPrice,
            unitCost: product.cost,
            quantity: lines[String(product.id)],
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法建立訂單。請稍後再試。");
      setOrderNumber(result.order.order_number);
      setSavedOrderId(result.order.id);
      setStatus("已確認");
      setOrderConfirmed(true);
      setModal(null);
    } catch (reason) {
      setOrderError(reason instanceof Error ? reason.message : "無法建立訂單。請稍後再試。");
      setModal(null);
    } finally {
      setSavingOrder(false);
    }
  };
  const deductInventory = async () => {
    if (!savedOrderId) return;
    setSavingOrder(true);
    setOrderError("");
    try {
      const response = await fetch(`/api/orders/${savedOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法完成訂單並扣除庫存。請稍後再試。");
      confirmOrder(lines);
      setStatus(result.order.status);
      setStockDeducted(true);
      setModal(null);
    } catch (reason) {
      setOrderError(reason instanceof Error ? reason.message : "無法完成訂單並扣除庫存。請稍後再試。");
      setModal(null);
    } finally {
      setSavingOrder(false);
    }
  };

  return <>
    <Header eyebrow="NEW ORDER" title="建立訂單" description="確認商品、數量與客戶資料後，訂單將立即更新可售庫存。" />
    {orderError && <Card className="mb-5 border-[#F1D4C4] bg-[#FFF7F0] p-4 text-sm font-semibold text-[#9B562A]">{orderError}</Card>}
    {stockDeducted && <Card className="mb-5 flex flex-col gap-3 border-[#D9E5DB] bg-[#EEF5EF] p-5 sm:flex-row sm:items-center sm:justify-between"><span><b className="block text-[#34563D]">訂單已確認並扣除庫存</b><small className="mt-1 block text-sm text-[#57735D]">訂單 {orderNumber} 已建立完成，可售庫存已同步更新。</small></span><Primary onClick={back}>查看訂單</Primary></Card>}

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card className="p-5 sm:p-6">
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">ORDER INFORMATION</p>
          <h2 className="mt-1 text-lg font-semibold">訂單資訊</h2>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <label className="text-sm font-semibold text-[#58534C]">訂單編號<input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none" /></label>
            <label className="text-sm font-semibold text-[#58534C]">訂單日期<input type="date" value={orderDate} onChange={(event) => changeOrderDate(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none" /></label>
            <label className="text-sm font-semibold text-[#58534C]">訂單狀態<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none"><option>待確認</option><option>已確認</option><option>已出貨</option></select></label>
            <label className="text-sm font-semibold text-[#58534C]">備註<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="輸入訂單備註" className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal outline-none placeholder:text-[#AAA39A]" /></label>
          </div>
          <div className="mt-5 border-t border-[#F0EDE8] pt-5"><p className="text-sm font-semibold text-[#58534C]">下單方式</p><p className="mt-1 text-xs text-[#938D84]">下單方式會套用商品預設價格，仍可逐筆調整單價。</p><div className="mt-3 grid grid-cols-2 gap-3"><button onClick={() => changeOrderMethod("social")} className={`rounded-xl border p-4 text-left ${orderMethod === "social" ? "border-[#86A28E] bg-[#EEF5EF]" : "border-[#E6E1DB] bg-[#FCFBF9]"}`}><b className="block text-sm">社群下單</b><small className="mt-1 block text-xs text-[#6F806F]">套用一般售價</small></button><button onClick={() => changeOrderMethod("staff")} className={`rounded-xl border p-4 text-left ${orderMethod === "staff" ? "border-[#86A28E] bg-[#EEF5EF]" : "border-[#E6E1DB] bg-[#FCFBF9]"}`}><b className="block text-sm">員工下單</b><small className="mt-1 block text-xs text-[#6F806F]">套用員工價</small></button></div></div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex justify-between"><span><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CUSTOMER</p><h2 className="mt-1 text-lg font-semibold">選擇客戶</h2></span><button onClick={() => { setCustomerError(""); setShowNewCustomer((value) => !value); }} className="text-sm font-semibold text-[#5E7665]">＋ 新增客戶</button></div>
          {showNewCustomer && <form onSubmit={saveNewCustomer} className="mt-5 rounded-xl border border-[#E9E5DF] bg-[#FCFBF9] p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-[#58534C]">客戶姓名<input required value={newCustomer.name} onChange={(event) => setNewCustomer((previous) => ({ ...previous, name: event.target.value }))} placeholder="例如：王思妤" className="mt-2 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#58534C]">LINE@名稱<input value={newCustomer.lineName} onChange={(event) => setNewCustomer((previous) => ({ ...previous, lineName: event.target.value }))} placeholder="例如：@szu.yi" className="mt-2 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#58534C]">電話<input value={newCustomer.phone} onChange={(event) => setNewCustomer((previous) => ({ ...previous, phone: event.target.value }))} placeholder="例如：0912-456-789" className="mt-2 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label><label className="text-sm font-semibold text-[#58534C]">地址<input value={newCustomer.address} onChange={(event) => setNewCustomer((previous) => ({ ...previous, address: event.target.value }))} placeholder="配送地址" className="mt-2 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal outline-none" /></label></div>{customerError && <p role="alert" className="mt-3 text-sm font-semibold text-[#A35F37]">{customerError}</p>}<div className="mt-4 flex justify-end gap-2"><Secondary onClick={() => setShowNewCustomer(false)}>取消</Secondary><Primary type="submit" disabled={savingCustomer}>{savingCustomer ? "新增中…" : "儲存客戶"}</Primary></div></form>}
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-3"><select value={selectedCustomerId} onChange={(event) => chooseCustomer(event.target.value)} className="h-11 min-w-0 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#58534C] outline-none"><option value="">選擇已建立的客戶</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.line_name ? ` · ${customer.line_name}` : ""}</option>)}</select><Secondary onClick={openCustomers} className="px-3">管理客戶</Secondary></div>
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#ECE8E2] bg-[#ECE8E2]">{customerFields.map(([label, value]) => <div key={label} className="bg-[#F8F6F2] p-4"><p className="text-xs font-semibold text-[#938D84]">{label}</p><p className="mt-1 break-words text-sm font-semibold leading-6 text-[#48433C]">{value}</p></div>)}</div>
        </Card>

        <Card className="p-5 sm:p-6">
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PRODUCTS</p><h2 className="mt-1 text-lg font-semibold">加入商品</h2>
          {!storedProducts.length && <p className="mt-4 rounded-xl bg-[#F8F6F2] p-4 text-sm leading-6 text-[#766F66]">請先到商品資料庫新增或匯入商品；訂單只會使用已儲存於資料庫的商品，才能正確扣除庫存。</p>}
          <div className="mt-5 overflow-x-auto"><div className="min-w-[500px]"><div className="grid grid-cols-[70px_minmax(120px,1fr)_82px_94px_64px] gap-2 border-b border-[#E8E4DD] bg-[#FBFAF8] px-2 py-3 text-[10px] font-semibold tracking-wide text-[#928C83]"><span>分類</span><span>商品名稱</span><span>單價</span><span>數量</span><span>淨利</span></div><div className="divide-y divide-[#F0EDE8]">{selected.map((product) => { const id = String(product.id); const price = linePrices[id] ?? product.retailPrice; return <div key={product.id} className="grid grid-cols-[70px_minmax(120px,1fr)_82px_94px_64px] items-center gap-2 px-2 py-4"><span className="text-xs font-medium leading-5 text-[#615C54] sm:text-sm">{product.category}</span><span className="min-w-0"><b className="block truncate text-xs sm:text-sm">{product.name}</b><small className="mt-1 block truncate text-[10px] text-[#918B81] sm:text-xs">{product.specification} · 可售 {stockFor(product)}</small></span><label><span className="sr-only">{product.name} 單價</span><input aria-label={`${product.name} 單價`} type="number" min="0" value={price} onChange={(event) => setLinePrices((previous) => ({ ...previous, [id]: Math.max(0, Number(event.target.value) || 0) }))} className="h-9 w-full rounded-lg border border-[#E6E1DB] bg-[#FCFBF9] px-2 text-xs font-semibold text-[#48433C] outline-none" /></label><span className="flex h-9 items-center rounded-lg border border-[#E6E1DB]"><button aria-label={`減少 ${product.name} 數量`} onClick={() => updateQuantity(id, -1)} className="h-full w-7 text-base">−</button><b className="w-7 text-center text-xs">{lines[id]}</b><button aria-label={`增加 ${product.name} 數量`} onClick={() => updateQuantity(id, 1)} className="h-full w-7 text-base">＋</button></span><b className={`text-xs ${price >= product.cost ? "text-[#45634C]" : "text-[#A66932]"}`}>{currency((price - product.cost) * lines[id])}</b></div>; })}</div></div></div>
          <div className="mt-5 flex flex-col gap-2 border-t border-[#F0EDE8] pt-5 sm:flex-row"><select value={addProductId} onChange={(event) => setAddProductId(event.target.value)} disabled={!availableProducts.length} className="h-11 min-w-0 flex-1 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#58534C] outline-none">{availableProducts.length ? availableProducts.map((product) => <option key={product.id} value={String(product.id)}>{product.name} · 可售 {stockFor(product)}</option>) : <option>目前沒有可加入的商品</option>}</select><Secondary onClick={addProduct} disabled={!availableProducts.length}>＋ 增加商品</Secondary></div>
          <p className="mt-3 text-xs text-[#938D84]">將數量減少至 0 時，該商品會自動從訂單中移除。</p>
        </Card>

        <Card className="p-5 sm:p-6"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">PAYMENT & DELIVERY</p><h2 className="mt-1 text-lg font-semibold">付款與配送</h2><div className="mt-5 grid grid-cols-2 gap-4"><label className="text-sm font-semibold text-[#58534C]">付款方式<select value={payment} onChange={(event) => setPayment(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal"><option>銀行轉帳</option><option>信用卡</option><option>現金</option></select></label>{payment === "銀行轉帳" && <label className="text-sm font-semibold text-[#58534C]">查帳狀態<select value={reconciliation} onChange={(event) => setReconciliation(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal"><option>待查帳</option><option>已查帳</option><option>查帳異常</option></select></label>}<label className={`text-sm font-semibold text-[#58534C] ${payment === "銀行轉帳" ? "col-span-2" : ""}`}>配送方式<select value={delivery} onChange={(event) => setDelivery(event.target.value as "pickup" | "myship")} className="mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal"><option value="pickup">門市自取</option><option value="myship">賣貨便</option></select></label></div>{payment === "銀行轉帳" && <small className="mt-2 block text-xs leading-5 text-[#938D84]">銀行轉帳訂單需完成查帳後再確認訂單。</small>}</Card>
      </div>

      <aside className="h-fit rounded-2xl border border-[#E9E5DF] bg-white p-5 sm:p-6 xl:sticky xl:top-6">
        <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">ORDER SUMMARY</p>
        <h2 className="mt-1 text-lg font-semibold">訂單摘要</h2>
        <p className="mt-2 text-xs text-[#938D84]">{orderMethod === "social" ? "社群下單 · 一般售價" : "員工下單 · 員工價"}</p>
        <div className="mt-5 space-y-3 border-b border-[#F0EDE8] pb-5">{selected.map((product) => { const id = String(product.id); const price = linePrices[id] ?? product.retailPrice; return <div key={product.id} className="flex justify-between gap-3 text-sm"><span className="text-[#676158]">{product.name}<small className="ml-2 text-[#99938A]">× {lines[id]}</small></span><b>{currency(price * lines[id])}</b></div>; })}</div>
        <div className="space-y-3 py-5 text-sm text-[#777168]">
          <div className="flex justify-between"><span>商品小計</span><span>{currency(subtotal)}</span></div>
          <div className="flex justify-between"><span>商品成本</span><span>{currency(costTotal)}</span></div>
          {delivery === "myship" && <div className="flex justify-between"><span>賣貨便運費</span><span>{shipping === 0 ? "免運" : currency(shipping)}</span></div>}
          <div className="flex justify-between border-t border-[#F0EDE8] pt-4 text-base font-semibold text-[#292824]"><span>訂單總額</span><span>{currency(total)}</span></div>
          <div className="flex justify-between text-sm font-semibold text-[#45634C]"><span>淨利</span><span>{currency(netProfit)}</span></div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2"><Primary onClick={() => setModal("confirm")} className="w-full" disabled={!selected.length || !selectedCustomerId || orderConfirmed || savingOrder}>確認訂單</Primary><Primary onClick={() => setModal("deduct")} className="w-full bg-[#5D7B64] hover:bg-[#4A6650]" disabled={!orderConfirmed || stockDeducted || savingOrder}>訂單完成（扣庫存）</Primary><Secondary onClick={() => { window.location.href = "/shipping-slip"; }} className="col-span-2 w-full">出貨單列印</Secondary></div>
      </aside>
    </div>

    <div className="mt-6 flex justify-center"><Secondary onClick={back} className="w-full sm:w-auto">取消建立</Secondary></div>

    {modal && <div className="fixed inset-0 z-50 flex items-end bg-[#292824]/30 sm:items-center sm:justify-center sm:p-6"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"><p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">FINAL CHECK</p><h2 className="mt-2 text-xl font-semibold">{modal === "confirm" ? "確認訂單？" : "完成訂單並扣除庫存？"}</h2><p className="mt-3 text-sm leading-6 text-[#766F66]">{modal === "confirm" ? "確認後，訂單資料會立即寫入資料庫；庫存可於下一步另外扣除。" : "完成訂單後，可售庫存會立即更新並保留完整的庫存異動紀錄。"}</p>{modal === "deduct" && <div className="mt-5 overflow-hidden rounded-xl border border-[#ECE8E2]"><div className="grid grid-cols-[1fr_45px_45px_60px] gap-2 bg-[#FBFAF8] px-4 py-3 text-[10px] font-bold text-[#938D84]"><span>商品</span><span>可售</span><span>本次</span><span>扣除後</span></div>{selected.map((product) => { const id = String(product.id); const available = stockFor(product); return <div key={product.id} className="grid grid-cols-[1fr_45px_45px_60px] gap-2 border-t border-[#F0EDE8] px-4 py-3 text-xs"><b className="truncate">{product.name}</b><span>{available}</span><span>{lines[id]}</span><b className="text-[#45634C]">{available - lines[id]}</b></div>; })}</div>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Secondary onClick={() => setModal(null)} disabled={savingOrder}>返回修改</Secondary><Primary onClick={modal === "confirm" ? () => { void confirmOrderAction(); } : () => { void deductInventory(); }} disabled={savingOrder}>{savingOrder ? "處理中…" : modal === "confirm" ? "確認訂單" : "訂單完成"}</Primary></div></div></div>}
  </>;
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0]);
  const [databaseProducts, setDatabaseProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<Record<string, number>>(() => Object.fromEntries(products.map(product => [String(product.id), product.available])));
  const refreshProducts = async () => {
    const response = await fetch("/api/products");
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "無法更新商品庫存。");
    const loaded: Product[] = (result.products ?? []).map((product: StoredProduct) => toProduct(product));
    setDatabaseProducts(loaded);
    setStock((previous) => ({ ...previous, ...Object.fromEntries(loaded.map((product) => [String(product.id), product.available])) }));
  };
  useEffect(() => {
    let active = true;
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const result = await response.json();
        if (!response.ok || !result.user) {
          window.location.replace("/login");
          return;
        }
        if (active) setCurrentUser(result.user);
      } catch {
        window.location.replace("/login");
      } finally {
        if (active) setAuthReady(true);
      }
    };
    void loadSession();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    void refreshProducts().catch(() => {
      // 商品資料庫連線失敗時，仍保留既有示範資料供介面操作。
    });
    return () => { active = false; };
  }, [currentUser]);
  const go = (next: View) => { setView(next); setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openProduct = (productOrId: Product | number | string) => { setSelectedProduct(typeof productOrId === "object" ? productOrId : [...databaseProducts, ...products].find((product) => String(product.id) === String(productOrId)) ?? products[0]); go("product"); };
  const addDatabaseProducts = (incoming: Product[]) => setDatabaseProducts((previous) => [...incoming, ...previous.filter((product) => !incoming.some((item) => item.id === product.id))]);
  const updateDatabaseProduct = (updated: Product) => {
    setDatabaseProducts((previous) => previous.map((product) => String(product.id) === String(updated.id) ? updated : product));
    setSelectedProduct((previous) => String(previous.id) === String(updated.id) ? updated : previous);
  };
  const deleteDatabaseProduct = async (product: Product) => {
    if (typeof product.id !== "string") throw new Error("只有已儲存到資料庫的商品可以刪除。");
    const response = await fetch(`/api/products?id=${encodeURIComponent(product.id)}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "無法刪除商品。");
    setDatabaseProducts((previous) => previous.filter((item) => item.id !== product.id));
    setStock((previous) => {
      const next = { ...previous };
      delete next[product.id];
      return next;
    });
  };
  const confirmOrder = (lines: Record<string, number>) => { setStock(previous => Object.fromEntries(Object.entries(previous).map(([id, amount]) => [id, amount - (lines[id] ?? 0)]))); setCreatedOrder(true); };
  const saveStockAdjustment = async (productId: string, quantity: number, reason: string, note: string) => {
    const response = await fetch("/api/inventory/adjustments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, quantityChange: quantity, reason, note }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "無法儲存庫存調整。");
    await refreshProducts();
  };
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  };
  if (!authReady || !currentUser) return <main className="flex min-h-screen items-center justify-center bg-[#F8F7F4] px-5 text-[#6F6960]"><p className="rounded-xl border border-[#E9E5DF] bg-white px-5 py-4 text-sm font-semibold">正在確認登入狀態…</p></main>;
  const catalog = [...databaseProducts, ...products];
  const content = view === "dashboard" ? <Dashboard go={go}/> : view === "orders" ? <Orders created={createdOrder} go={go}/> : view === "products" ? <Products catalog={catalog} openProduct={openProduct} openNewProduct={() => go("newProduct")} openImportProducts={() => go("importProducts")} deleteProduct={deleteDatabaseProduct}/> : view === "product" ? <ProductPage product={selectedProduct} stock={stock[String(selectedProduct.id)] ?? selectedProduct.available} back={() => go("products")} openStock={() => go("stock")} onUpdated={updateDatabaseProduct}/> : view === "newProduct" ? <NewProduct back={() => go("products")} onCreated={(product) => addDatabaseProducts([product])}/> : view === "importProducts" ? <ImportProducts back={() => go("products")} onImported={addDatabaseProducts}/> : view === "newPurchase" ? <NewPurchase catalog={databaseProducts} back={() => go("purchases")} openSuppliers={() => go("suppliers")} onCreated={refreshProducts}/> : view === "purchases" ? <PurchasesPage go={go} onInventoryChanged={refreshProducts}/> : view === "inventory" ? <InventoryManagement go={go}/> : view === "stock" ? <StockOverview catalog={databaseProducts} stock={stock} openProduct={openProduct} saveAdjustment={saveStockAdjustment}/> : view === "create" ? <CreateOrder catalog={catalog} stock={stock} confirmOrder={confirmOrder} back={() => go("orders")} openCustomers={() => go("customers")}/> : view === "settings" ? <SystemSettings currentUser={currentUser} /> : view === "customers" ? <CustomerManagement /> : view === "suppliers" ? <SupplierManagement /> : <GenericPage view={view} go={go}/>;
  const isProductsView = view === "products" || view === "product" || view === "newProduct" || view === "importProducts";
  const links = <nav className="space-y-1">{nav.map(item => <button key={item.id} onClick={() => go(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${view === item.id || (isProductsView && item.id === "products") || (view === "newPurchase" && item.id === "purchases") ? "bg-[#EAF1EB] text-[#45634C]" : "text-[#6B665E] hover:bg-[#F2F0EC]"}`}><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[9px] ${view === item.id || (isProductsView && item.id === "products") || (view === "newPurchase" && item.id === "purchases") ? "bg-[#D8E6DA]" : "bg-[#F0EDE8] text-[#888178]"}`}>{item.no}</span>{item.label}</button>)}</nav>;
  const displayRole = currentUser.role === "admin" ? "系統管理員" : "員工";
  const initial = currentUser.displayName.trim().slice(0, 1) || "U";
  return <div className="min-h-screen bg-[#F8F7F4] text-[#292824]"><aside className="fixed inset-y-0 left-0 z-40 hidden w-[244px] flex-col border-r border-[#E9E5DF] bg-[#FCFBF9] px-4 py-5 lg:flex"><div className="px-2"><p className="text-[11px] font-bold tracking-[.2em] text-[#8E887F]">MUSE STOCK</p><p className="mt-1 text-sm font-semibold text-[#45413B]">商品與庫存管理</p></div><div className="mt-10">{links}</div><div className="mt-auto"><Primary onClick={() => go("create")} className="w-full">＋ 建立訂單</Primary><button onClick={() => go("settings")} className="mt-6 flex w-full items-center gap-3 border-t border-[#E9E5DF] px-2 pt-5 text-left"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E5DDD2] text-xs font-bold text-[#766859]">{initial}</span><span className="min-w-0"><b className="block truncate text-sm">{currentUser.displayName}</b><small className="block text-xs text-[#969087]">{displayRole}</small></span></button></div></aside><div className="lg:pl-[244px]"><header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#E9E5DF] bg-[#F8F7F4]/90 px-5 backdrop-blur sm:px-8"><div className="flex items-center gap-3"><button aria-label="開啟選單" onClick={() => setMenuOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E0D9] bg-white text-lg lg:hidden">≡</button><div className="hidden h-10 min-w-[270px] items-center gap-2 rounded-xl border border-[#E7E2DB] bg-white px-3 text-sm text-[#AAA39A] md:flex">⌕　搜尋商品、SKU、條碼或訂單</div><b className="text-sm md:hidden">MUSE STOCK</b></div><div className="relative flex items-center gap-2"><button aria-label="通知" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E0D9] bg-white text-[#726C63]">◌<span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#C8796D]"/></button><button onClick={() => setAccountOpen((value) => !value)} className="hidden h-10 items-center gap-2 rounded-xl border border-[#E4E0D9] bg-white px-3 text-sm font-semibold sm:flex"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E5DDD2] text-[10px]">{initial}</span>{currentUser.displayName}</button>{accountOpen && <div className="absolute right-0 top-12 w-52 rounded-2xl border border-[#E9E5DF] bg-white p-2 shadow-xl"><button onClick={() => { go("settings"); setAccountOpen(false); }} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#5D7764] hover:bg-[#F3F7F3]">系統設定</button><button onClick={signOut} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#9A5B38] hover:bg-[#FFF7F0]">登出</button></div>}</div></header><main className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9">{content}</main></div>{menuOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="關閉選單" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-[#292824]/30"/><aside className="relative flex h-full w-[280px] flex-col bg-[#FCFBF9] p-5 shadow-2xl"><p className="text-[11px] font-bold tracking-[.2em] text-[#8E887F]">MUSE STOCK</p><p className="mt-1 text-sm font-semibold">商品與庫存管理</p><div className="mt-8">{links}</div><button onClick={signOut} className="mt-auto text-sm font-semibold text-[#9A5B38]">登出</button><Primary onClick={() => go("create")} className="mt-4 w-full">＋ 建立訂單</Primary></aside></div>}</div>;
}
