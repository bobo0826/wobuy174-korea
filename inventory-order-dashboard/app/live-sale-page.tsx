"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Product = {
  id: string | number;
  sku: string;
  name: string;
  country: string;
  category: string;
  subcategory: string;
  specification: string;
  cost: number;
  retailPrice: number;
};
type LiveSaleProduct = {
  id: string;
  campaign_id: string;
  name: string;
  country: string;
  category: string;
  subcategory: string;
  specification: string;
  local_price: number;
  cost: number;
  retail_price: number;
  note: string;
  promoted_product_id: string | null;
};
type Customer = {
  id: string;
  name: string;
  line_name: string;
  customer_category: "員工" | "社群";
  preferred_delivery_method: "自取" | "賣貨便";
  phone?: string;
  address?: string;
};
type ClaimStatus = "待核對" | "待結帳" | "已結帳" | "已轉訂單" | "已取消";
type NotificationStatus = "未通知" | "已通知";
type ClaimItem = {
  id?: string;
  product_id: string | null;
  live_sale_product_id?: string | null;
  product_name: string;
  category: string;
  specification: string;
  unit_price: number;
  quantity: number;
};
type ConvertedOrder = {
  id: string;
  order_number: string;
  status: "預購中" | "未出貨" | "已出貨" | "已取消";
  payment_method: string;
  reconciliation_status: string;
  delivery_method: string;
  total: number;
};
type Claim = {
  id: string;
  claim_number: string;
  customer_id: string | null;
  customer_name: string;
  line_name: string;
  community_name: string;
  source_inbox_id: string | null;
  status: ClaimStatus;
  notification_status: NotificationStatus;
  claim_total: number;
  note: string;
  converted_order_id: string | null;
  converted_order?: ConvertedOrder | null;
  created_at: string;
  items: ClaimItem[];
};
type Summary = {
  claimCount: number;
  activeAmount: number;
  paidAmount: number;
  pendingAmount: number;
  unresolvedCount: number;
};
type Campaign = {
  id: string;
  name: string;
  campaign_code: string;
  status: "進行中" | "已結單" | "已封存";
  start_date: string;
  end_date: string | null;
  note: string;
  source_spreadsheet_url: string;
  summary: Summary;
};
type Procurement = {
  productId: string | null;
  productName: string;
  specification: string;
  category: string;
  demandQuantity: number;
  paidQuantity: number;
  unresolvedQuantity: number;
  receivedQuantity: number | null;
  availableQuantity: number | null;
  purchaseQuantity: number | null;
  shortageQuantity: number | null;
  affectedCustomers: Array<{
    claimId: string;
    claimNumber: string;
    customerName: string;
    quantity: number;
  }>;
};
type Detail = {
  campaign: Campaign;
  claims: Claim[];
  summary: Summary;
  procurement: Procurement[];
};
type Inbox = {
  id: string;
  message_text: string;
  line_display_name: string;
  parsed_items: Array<{
    product_id: string | null;
    live_sale_product_id?: string | null;
    product_name: string;
    specification: string;
    unit_price: number;
    quantity: number;
  }>;
  matched_customer: { id: string; name: string; line_name: string } | null;
};
type Line = {
  key: string;
  productId: string;
  liveSaleProductId: string;
  productName: string;
  category: string;
  specification: string;
  unitPrice: number;
  quantity: number;
};
type ActionName =
  "markPaid" | "markUnpaid" | "cancel" | "restore" | "convert" | "delete";

const money = (value: number) =>
  `NT$ ${Number(value || 0).toLocaleString("zh-TW")}`;
const localCurrency: Record<string, string> = {
  韓國: "₩",
  日本: "¥",
  大陸: "CN¥",
  台灣: "NT$",
  其他: "$",
};
const day = (value: string | null) =>
  value ? value.replaceAll("-", "/") : "—";
const lineKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const button =
  "inline-flex h-10 items-center justify-center rounded-xl bg-[#292824] px-3 text-sm font-semibold text-white disabled:opacity-45";
const secondary =
  "inline-flex h-10 items-center justify-center rounded-xl border border-[#DED9D1] bg-white px-3 text-sm font-semibold text-[#5E7665] disabled:opacity-45";
const tone: Record<ClaimStatus, string> = {
  待核對: "bg-[#FAECDD] text-[#A66932]",
  待結帳: "bg-[#E5EEF2] text-[#4B6D79]",
  已結帳: "bg-[#E7F0E8] text-[#477154]",
  已轉訂單: "bg-[#E9E6F4] text-[#625184]",
  已取消: "bg-[#F0EDE8] text-[#6F6960]",
};

const claimStatusLabel: Record<ClaimStatus, string> = {
  待核對: "待核對",
  待結帳: "未結單",
  已結帳: "已結單",
  已轉訂單: "已結單",
  已取消: "已取消",
};

function Pill({ status }: { status: ClaimStatus }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center justify-center rounded-full px-2.5 py-1 text-center text-[11px] font-semibold leading-none ${tone[status]}`}
    >
      {claimStatusLabel[status]}
    </span>
  );
}

function Metric({
  label,
  value,
  note,
  compact = false,
}: {
  label: string;
  value: string;
  note: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-[#EAE6E0] bg-[#FCFBF9] ${compact ? "p-2 text-center sm:p-3" : "p-4"}`}>
      <p className={compact ? "truncate text-[10px] font-semibold text-[#837D73]" : "text-xs font-semibold text-[#837D73]"}>{label}</p>
      <p className={compact ? "mt-1 truncate text-sm font-semibold sm:text-lg" : "mt-2 text-xl font-semibold"}>{value}</p>
      <p className={compact ? "hidden" : "mt-1 text-xs text-[#938D84]"}>{note}</p>
    </div>
  );
}

function ProductSearch({
  products,
  liveProducts,
  onAdd,
  onAddLive,
}: {
  products: Product[];
  liveProducts: LiveSaleProduct[];
  onAdd: (product: Product) => void;
  onAddLive: (product: LiveSaleProduct) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const word = query.trim().toLocaleLowerCase("zh-TW");
    return products.filter((item) =>
      [
        item.sku,
        item.name,
        item.country,
        item.category,
        item.subcategory,
        item.specification,
      ]
        .join(" ")
        .toLocaleLowerCase("zh-TW")
        .includes(word),
    );
  }, [products, query]);
  const liveMatches = useMemo(() => {
    const word = query.trim().toLocaleLowerCase("zh-TW");
    return liveProducts.filter((item) =>
      [item.name, item.country, item.category, item.subcategory, item.specification]
        .join(" ")
        .toLocaleLowerCase("zh-TW")
        .includes(word),
    );
  }, [liveProducts, query]);

  return (
    <div className="relative">
      <label className="flex h-11 items-center gap-2 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#928C84]">
        ⌕
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder="搜尋貨號、商品名稱或分類後加入商品"
          className="min-w-0 flex-1 bg-transparent text-[#58534C] outline-none"
        />
      </label>
      {open && (
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-[#E6E1DB] bg-white p-1 shadow-lg">
          {matches.length || liveMatches.length ? (
            <>
            {liveMatches.map((item) => (
              <button
                key={`live-${item.id}`}
                type="button"
                onClick={() => {
                  onAddLive(item);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-[#F3F7F3]"
              >
                <span className="min-w-0">
                  <b className="block truncate text-sm">{item.name}</b>
                  <small className="mt-1 block truncate text-xs text-[#8D877E]">本檔期暫存商品 · {[item.country, item.category, item.subcategory, item.specification].filter(Boolean).join(" · ")}</small>
                </span>
                <span className="shrink-0 text-xs font-semibold text-[#5E7665]">加入商品</span>
              </button>
            ))}
            {matches.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onAdd(item);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-[#F8F6F2]"
              >
                <span className="min-w-0">
                  <b className="block truncate text-sm">
                    {item.sku}｜{item.name}
                  </b>
                  <small className="mt-1 block truncate text-xs text-[#8D877E]">
                    {[
                      item.country,
                      item.category,
                      item.subcategory,
                      item.specification,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <span className="shrink-0 text-xs font-semibold text-[#5E7665]">
                  加入商品
                </span>
              </button>
            ))}
            </>
          ) : (
            <p className="p-4 text-sm text-[#8D877E]">找不到可加入的商品。</p>
          )}
        </div>
      )}
    </div>
  );
}

function ClaimEditor({
  campaignId,
  campaignArchived,
  catalog,
  liveProducts,
  customers,
  initial,
  inbox,
  onCancel,
  onSaved,
  onAction,
  openOrder,
  onCustomerCreated,
}: {
  campaignId: string;
  campaignArchived: boolean;
  catalog: Product[];
  liveProducts: LiveSaleProduct[];
  customers: Customer[];
  initial?: Claim;
  inbox?: Inbox | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onAction: (claim: Claim, action: ActionName) => Promise<void>;
  openOrder: (id: string) => void;
  onCustomerCreated: (customer: Customer) => void;
}) {
  const [customerId, setCustomerId] = useState(
    initial?.customer_id ?? inbox?.matched_customer?.id ?? "",
  );
  const [customerName, setCustomerName] = useState(
    initial?.customer_name ?? inbox?.matched_customer?.name ?? "",
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerSaving, setNewCustomerSaving] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    lineName: inbox?.line_display_name ?? "",
    customerCategory: "社群" as Customer["customer_category"],
    preferredDeliveryMethod: "自取" as Customer["preferred_delivery_method"],
  });
  const [lines, setLines] = useState<Line[]>(
    initial?.items.length
      ? initial.items.map((item) => ({
          key: item.id ?? lineKey(),
          productId: item.product_id ?? "",
          liveSaleProductId: item.live_sale_product_id ?? "",
          productName: item.product_name,
          category: item.category,
          specification: item.specification,
          unitPrice: item.unit_price,
          quantity: item.quantity,
        }))
      : (inbox?.parsed_items.map((item) => ({
          key: lineKey(),
          productId: item.product_id ?? "",
          liveSaleProductId: item.live_sale_product_id ?? "",
          productName: item.product_name,
          category: "",
          specification: item.specification,
          unitPrice: item.unit_price,
          quantity: item.quantity,
        })) ?? []),
  );
  const catalogById = useMemo(
    () => new Map(catalog.map((item) => [String(item.id), item])),
    [catalog],
  );
  const liveProductById = useMemo(
    () => new Map(liveProducts.map((item) => [item.id, item])),
    [liveProducts],
  );
  const locked = campaignArchived || initial?.status === "已轉訂單";
  const foundCustomers = useMemo(() => {
    const word = customerName.trim().toLocaleLowerCase("zh-TW");
    return !word || customerId
      ? []
      : customers
          .filter((item) =>
            `${item.name} ${item.line_name} ${item.customer_category}`
              .toLocaleLowerCase("zh-TW")
              .includes(word),
          )
          .slice(0, 8);
  }, [customerId, customerName, customers]);
  const total = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const totalProfit = lines.reduce<number | null>((sum, line) => {
    const product = catalogById.get(line.productId);
    const liveProduct = liveProductById.get(line.liveSaleProductId);
    const cost = product?.cost ?? liveProduct?.cost;
    return sum === null || cost === undefined
      ? null
      : sum + (line.unitPrice - cost) * line.quantity;
  }, 0);

  const add = (product: Product) =>
    setLines((current) => {
      const existing = current.find(
        (line) => line.productId === String(product.id),
      );
      return existing
        ? current.map((line) =>
            line.key === existing.key
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          )
        : [
            ...current,
            {
              key: lineKey(),
              productId: String(product.id),
              liveSaleProductId: "",
              productName: product.name,
              category: [product.country, product.category, product.subcategory]
                .filter(Boolean)
                .join(" · "),
              specification: product.specification,
              unitPrice: product.retailPrice,
              quantity: 1,
            },
          ];
    });

  const addLiveProduct = (product: LiveSaleProduct) =>
    setLines((current) => {
      const existing = current.find(
        (line) => line.liveSaleProductId === product.id,
      );
      return existing
        ? current.map((line) =>
            line.key === existing.key
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          )
        : [
            ...current,
            {
              key: lineKey(),
              productId: "",
              liveSaleProductId: product.id,
              productName: product.name,
              category: [product.country, product.category, product.subcategory]
                .filter(Boolean)
                .join(" · "),
              specification: product.specification,
              unitPrice: product.retail_price,
              quantity: 1,
            },
          ];
    });

  const createCustomer = async () => {
    if (!newCustomer.name.trim()) {
      setError("請填寫客戶姓名後再建立客戶。");
      return;
    }
    setNewCustomerSaving(true);
    setError("");
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomer),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法建立客戶。");
      const customer = result.customer as Customer;
      onCustomerCreated(customer);
      setCustomerId(customer.id);
      setCustomerName(
        `${customer.name}${customer.line_name ? ` · ${customer.line_name}` : ""}`,
      );
      setShowNewCustomer(false);
      setNewCustomer({
        name: "",
        lineName: "",
        customerCategory: "社群",
        preferredDeliveryMethod: "自取",
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法建立客戶。");
    } finally {
      setNewCustomerSaving(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (locked) {
      setError("此連線檔期已封存，喊單僅供查看，無法修改。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (!lines.length) throw new Error("請先加入至少一項商品。");
      const payload = {
        customerId: customerId || undefined,
        communityName: initial?.community_name || "LINE 私訊",
        note,
        sourceInboxId: initial?.source_inbox_id ?? inbox?.id ?? undefined,
        items: lines.map((line) => ({
          productId: line.productId || undefined,
          liveSaleProductId: line.liveSaleProductId || undefined,
          productName: line.productName,
          specification: line.specification,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
        })),
      };
      const response = await fetch(
        initial
          ? `/api/live-sale/claims/${initial.id}`
          : `/api/live-sale/campaigns/${campaignId}/claims`,
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            initial ? { action: "update", ...payload } : payload,
          ),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法儲存喊單。");
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法儲存喊單。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="mx-auto max-w-6xl">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-semibold text-[#5E7665]"
          >
            ← 返回喊單列表
          </button>
          <p className="mt-5 text-[11px] font-bold tracking-[.16em] text-[#A09A90]">
            LIVE SALE CLAIM
          </p>
          <h1 className="mt-2 text-[29px] font-semibold">
            {initial ? `喊單 ${initial.claim_number}` : "建立連線喊單"}
          </h1>
          <p className="mt-2 text-sm text-[#7B766E]">
            可用貨號、商品名稱或分類搜尋加入商品，版面與一般訂單一致。
          </p>
        </div>
        {initial && (
          <div className="flex flex-wrap gap-2">
            <Pill status={initial.status} />
            {!locked && (
              <>
                {initial.status === "待結帳" && (
                  <button
                    type="button"
                    onClick={() => void onAction(initial, "markPaid")}
                    className={button}
                  >
                    確認結單並轉一般訂單
                  </button>
                )}
                {initial.status === "已結帳" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void onAction(initial, "convert")}
                      className={button}
                    >
                      轉一般訂單
                    </button>
                    <button
                      type="button"
                      onClick={() => void onAction(initial, "markUnpaid")}
                      className={secondary}
                    >
                      回未結單
                    </button>
                  </>
                )}
                {initial.status === "已取消" && (
                  <button
                    type="button"
                    onClick={() => void onAction(initial, "restore")}
                    className={secondary}
                  >
                    復原喊單
                  </button>
                )}
                {initial.status !== "已取消" && initial.status !== "已轉訂單" && (
                  <button
                    type="button"
                    onClick={() => void onAction(initial, "cancel")}
                    className="inline-flex h-10 items-center rounded-xl border border-[#F0D6C2] bg-white px-3 text-sm font-semibold text-[#A35F37]"
                  >
                    取消喊單
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void onAction(initial, "delete")}
                  className="inline-flex h-10 items-center rounded-xl border border-[#F0D6C2] bg-white px-3 text-sm font-semibold text-[#A35F37]"
                >
                  刪除喊單
                </button>
              </>
            )}
            {!locked && initial.converted_order_id && (
              <button
                type="button"
                onClick={() => openOrder(initial.converted_order_id!)}
                className={secondary}
              >
                編輯訂單
              </button>
            )}
          </div>
        )}
      </div>
      {campaignArchived && (
        <p className="mb-5 rounded-xl border border-[#E1DED8] bg-[#F7F5F2] p-3 text-sm text-[#6F6960]">
          此連線檔期已封存，喊單資料僅供查看，無法修改、刪除或轉單。
        </p>
      )}
      {inbox && (
        <section className="mb-5 rounded-2xl border border-[#DEE8DF] bg-[#F8FBF8] p-5">
          <p className="text-xs font-semibold text-[#5E7665]">LINE 私訊原文</p>
          {inbox.line_display_name && <p className="mt-2 text-xs text-[#6F6960]">LINE@ 名稱：{inbox.line_display_name}</p>}
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {inbox.message_text}
          </p>
        </section>
      )}
      {error && (
        <p className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] p-3 text-sm text-[#A35F37]">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-[#E9E5DF] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            喊單來源
            <p className="mt-2 flex h-10 items-center rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm font-normal">
              {initial?.community_name || "LINE 私訊"}
            </p>
          </label>
          <div className="relative text-sm font-semibold">
            <div className="flex items-center justify-between gap-3">
              <span>客戶／LINE@ 名稱</span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => setShowNewCustomer((value) => !value)}
                  className="text-xs font-semibold text-[#5E7665]"
                >
                  ＋ 直接建立客戶
                </button>
              )}
            </div>
            <input
              disabled={locked}
              value={customerName}
              onChange={(event) => {
                setCustomerName(event.target.value);
                setCustomerId("");
              }}
              placeholder="搜尋姓名、LINE@ 名稱或員工"
              className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 font-normal outline-none"
            />
            {!locked && !customerId && customerName && (
              <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[#DDD8D1] bg-white p-1 shadow-lg">
                {foundCustomers.length ? (
                  foundCustomers.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCustomerId(item.id);
                        setCustomerName(
                          `${item.name}${item.line_name ? ` · ${item.line_name}` : ""}`,
                        );
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-[#F3F7F3]"
                    >
                      <span>
                        <b className="block">{item.name}</b>
                        <small className="text-xs font-normal text-[#847E75]">
                          {item.line_name || "未填 LINE@ 名稱"}
                        </small>
                      </span>
                      <span className="rounded-full bg-[#E7F0E8] px-2 py-1 text-[11px]">
                        {item.customer_category}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="p-3 text-xs font-normal text-[#8D877E]">
                    找不到相符客戶；可直接建立。
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        {!locked && showNewCustomer && (
          <div className="mt-5 rounded-xl border border-[#D9E5DB] bg-[#F6FAF6] p-4">
            <div className="mb-3 flex items-center justify-between">
              <b className="text-sm">建立客戶並直接帶入喊單</b>
              <button
                type="button"
                onClick={() => setShowNewCustomer(false)}
                className="text-sm text-[#6F6960]"
              >
                關閉
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-semibold">
                客戶姓名
                <input
                  value={newCustomer.name}
                  onChange={(event) =>
                    setNewCustomer({ ...newCustomer, name: event.target.value })
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal"
                />
              </label>
              <label className="text-xs font-semibold">
                LINE@ 名稱
                <input
                  value={newCustomer.lineName}
                  onChange={(event) =>
                    setNewCustomer({
                      ...newCustomer,
                      lineName: event.target.value,
                    })
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal"
                />
              </label>
              <label className="text-xs font-semibold">
                客戶類別
                <select
                  value={newCustomer.customerCategory}
                  onChange={(event) =>
                    setNewCustomer({
                      ...newCustomer,
                      customerCategory: event.target
                        .value as Customer["customer_category"],
                    })
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal"
                >
                  <option>社群</option>
                  <option>員工</option>
                </select>
              </label>
              <label className="text-xs font-semibold">
                常用配送方式
                <select
                  value={newCustomer.preferredDeliveryMethod}
                  onChange={(event) =>
                    setNewCustomer({
                      ...newCustomer,
                      preferredDeliveryMethod: event.target
                        .value as Customer["preferred_delivery_method"],
                    })
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-[#E6E1DB] bg-white px-3 text-sm font-normal"
                >
                  <option>自取</option>
                  <option>賣貨便</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                disabled={newCustomerSaving}
                type="button"
                onClick={() => void createCustomer()}
                className={secondary}
              >
                {newCustomerSaving ? "建立中…" : "建立並選取客戶"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-5 overflow-visible rounded-2xl border border-[#E9E5DF] bg-white">
        <div className="border-b border-[#F0EDE8] p-5">
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">
            ITEMS
          </p>
          <h2 className="mt-1 text-lg font-semibold">加入商品</h2>
        </div>
        <div className="divide-y divide-[#F0EDE8] md:hidden">
          {lines.length ? (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_34px_54px_54px_54px] gap-1 border-b border-[#F0EDE8] bg-[#FBFAF8] px-3 py-2.5 text-[10px] font-bold tracking-wide text-[#928C83]">
                <span>品名</span>
                <span className="text-center">數量</span>
                <span className="text-right">售價</span>
                <span className="text-right">成本</span>
                <span className="text-right text-[#477154]">淨利</span>
              </div>
              {lines.map((line) => {
              const product = catalogById.get(line.productId);
              const liveProduct = liveProductById.get(line.liveSaleProductId);
              const unitCost = product?.cost ?? liveProduct?.cost;
              const lineCost = unitCost === undefined ? null : unitCost * line.quantity;
              const profit = unitCost === undefined ? null : (line.unitPrice - unitCost) * line.quantity;
              return (
                <div key={line.key} className="grid min-w-0 grid-cols-[minmax(0,1fr)_34px_54px_54px_54px] items-center gap-1 px-3 py-3">
                  <span className="min-w-0"><b className="block truncate text-sm text-[#403C36]">{line.productName || "待核對商品"}</b><small className="mt-0.5 block truncate text-[11px] text-[#938D84]">{line.specification || "—"}</small></span>
                  <input aria-label={`${line.productName} 數量`} disabled={locked} type="number" min="0" value={line.quantity} onChange={(event) => { const quantity = Math.max(0, Number(event.target.value) || 0); setLines((current) => quantity === 0 ? current.filter((item) => item.key !== line.key) : current.map((item) => item.key === line.key ? { ...item, quantity } : item)); }} className="h-9 min-w-0 rounded-lg border border-[#E6E1DB] bg-[#FCFBF9] px-1 text-center text-sm" />
                  <input aria-label={`${line.productName} 單價`} disabled={locked} type="number" min="0" value={line.unitPrice} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, unitPrice: Math.max(0, Number(event.target.value) || 0) } : item))} className="h-9 min-w-0 rounded-lg border border-[#E6E1DB] bg-[#FCFBF9] px-1 text-right text-sm" />
                  <span className="truncate text-right text-[11px] text-[#817B72]">{lineCost === null ? "—" : money(lineCost)}</span>
                  <span className={`truncate text-right text-[11px] font-semibold ${profit === null ? "text-[#928C83]" : profit < 0 ? "text-[#A66932]" : "text-[#477154]"}`}>{profit === null ? "—" : money(profit)}</span>
                </div>
              );
              })}
            </>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-[#8D877E]">請先搜尋並加入商品。</p>
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]">
              <tr>
                <th className="px-5 py-3">貨號</th>
                <th className="px-3 py-3">分類</th>
                <th className="px-3 py-3">商品名稱</th>
                <th className="px-3 py-3">單價</th>
                <th className="px-3 py-3">數量</th>
                <th className="px-3 py-3">淨利</th>
                <th className="px-5 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDE8]">
              {lines.length ? (
                lines.map((line) => {
                  const product = catalogById.get(line.productId);
                  const liveProduct = liveProductById.get(line.liveSaleProductId);
                  const unitCost = product?.cost ?? liveProduct?.cost;
                  const profit = unitCost === undefined
                    ? null
                    : (line.unitPrice - unitCost) * line.quantity;
                  return (
                    <tr key={line.key}>
                      <td className="px-5 py-4 font-mono text-xs text-[#6E695F]">
                        {product?.sku || (liveProduct ? "檔期暫存" : "—")}
                      </td>
                      <td className="px-3 py-4 text-xs">
                        {line.category || "—"}
                      </td>
                      <td className="px-3 py-4">
                        <b>{line.productName || "待核對商品"}</b>
                        <small className="mt-1 block text-xs text-[#938D84]">
                          {line.specification || "未填規格"}
                        </small>
                      </td>
                      <td className="px-3 py-4">
                        <input
                          disabled={locked}
                          type="number"
                          min="0"
                          value={line.unitPrice}
                          onChange={(event) =>
                            setLines((current) =>
                              current.map((item) =>
                                item.key === line.key
                                  ? {
                                      ...item,
                                      unitPrice: Math.max(
                                        0,
                                        Number(event.target.value) || 0,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                          className="h-9 w-24 rounded-lg border border-[#E6E1DB] bg-[#FCFBF9] px-2"
                        />
                      </td>
                      <td className="px-3 py-4">
                        <input
                          disabled={locked}
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(event) =>
                            setLines((current) =>
                              current.map((item) =>
                                item.key === line.key
                                  ? {
                                      ...item,
                                      quantity: Math.max(
                                        1,
                                        Number(event.target.value) || 1,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                          className="h-9 w-20 rounded-lg border border-[#E6E1DB] bg-[#FCFBF9] px-2"
                        />
                      </td>
                      <td
                        className={`px-3 py-4 font-semibold ${profit === null ? "text-[#928C83]" : profit < 0 ? "text-[#A66932]" : "text-[#477154]"}`}
                      >
                        {profit === null ? "—" : money(profit)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          disabled={locked}
                          type="button"
                          onClick={() =>
                            setLines((current) =>
                              current.filter((item) => item.key !== line.key),
                            )
                          }
                          className="text-sm font-semibold text-[#A35F37] disabled:opacity-40"
                        >
                          移除
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-[#8D877E]">
                    請先搜尋並加入商品。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!locked && (
          <div className="border-t border-[#F0EDE8] p-5">
            <ProductSearch products={catalog} liveProducts={liveProducts} onAdd={add} onAddLive={addLiveProduct} />
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-3 border-t border-[#F0EDE8] px-5 py-4 text-sm">
          喊單總額 <b>{money(total)}</b>
          <span>
            訂單淨利{" "}
            <b className="text-[#477154]">
              {totalProfit === null ? "待核對" : money(totalProfit)}
            </b>
          </span>
        </div>
      </section>
      <label className="mt-5 block text-sm font-semibold">
        內部備註
        <textarea
          disabled={locked}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="mt-2 min-h-24 w-full rounded-xl border border-[#E6E1DB] p-3 font-normal"
        />
      </label>
      {!locked && (
        <div className="mt-5 flex justify-end">
          <button disabled={saving} className={button}>
            {saving ? "儲存中…" : initial ? "儲存喊單修改" : "建立待核對喊單"}
          </button>
        </div>
      )}
    </form>
  );
}

const blankLiveProduct = () => ({
  id: "",
  name: "",
  country: "韓國",
  category: "",
  subcategory: "",
  specification: "",
  localPrice: "",
  cost: "",
  retailPrice: "",
  note: "",
});

function LiveSaleProductPanel({
  campaignId,
  archived,
  products,
  sourceSpreadsheetUrl,
  onChanged,
}: {
  campaignId: string;
  archived: boolean;
  products: LiveSaleProduct[];
  sourceSpreadsheetUrl: string;
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState(blankLiveProduct);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-Hant")),
    [products],
  );
  const visibleProducts = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const matchesCategory = !categoryFilter || product.category === categoryFilter;
      const matchesKeyword = !keyword || [product.name, product.country, product.category, product.subcategory, product.specification]
        .join(" ")
        .toLocaleLowerCase()
        .includes(keyword);
      return matchesCategory && matchesKeyword;
    });
  }, [categoryFilter, products, search]);
  const currencySymbol = localCurrency[form.country] ?? "$";
  const update = (key: keyof ReturnType<typeof blankLiveProduct>, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const edit = (product: LiveSaleProduct) => {
    setForm({
      id: product.id,
      name: product.name,
      country: product.country,
      category: product.category,
      subcategory: product.subcategory,
      specification: product.specification,
      localPrice: String(product.local_price),
      cost: String(product.cost),
      retailPrice: String(product.retail_price),
      note: product.note,
    });
    setError("");
    setOpen(true);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/live-sale/campaigns/${campaignId}/products`, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法儲存檔期商品。");
      setForm(blankLiveProduct());
      setOpen(false);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法儲存檔期商品。");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (product: LiveSaleProduct) => {
    if (!window.confirm(`確定刪除檔期暫存商品「${product.name}」？`)) return;
    setError("");
    try {
      const response = await fetch(`/api/live-sale/campaigns/${campaignId}/products?id=${encodeURIComponent(product.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法刪除檔期商品。");
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法刪除檔期商品。");
    }
  };
  const sync = async () => {
    setSyncing(true);
    setError("");
    setSyncNotice("");
    try {
      const response = await fetch(`/api/live-sale/campaigns/${campaignId}/products/sync`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法同步 Google 試算表商品。");
      setSyncNotice(`已新增 ${result.importedCount ?? 0} 項；略過 ${result.skippedDuplicateCount ?? 0} 項重複資料${result.skippedInvalidRows?.length ? `；${result.skippedInvalidRows.join("、")}資料不完整` : ""}。`);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法同步 Google 試算表商品。");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EDE8] p-5">
        <div>
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CAMPAIGN PRODUCTS</p>
          <h2 className="mt-1 text-lg font-semibold">檔期商品庫</h2>
          <p className="mt-1 text-xs text-[#8D877E]">只暫存於此檔期；客人喊單後才會建立正式商品。封存時會清除未被喊單的品項。</p>
        </div>
        {!archived && <div className="flex flex-wrap gap-2"><button type="button" disabled={!sourceSpreadsheetUrl || syncing} onClick={() => void sync()} className={secondary}>{syncing ? "同步中…" : "同步試算表"}</button><button type="button" onClick={() => { setForm(blankLiveProduct()); setError(""); setOpen((value) => !value); }} className={secondary}>{open ? "收合表單" : "新增檔期商品"}</button></div>}
      </div>
      {error && <p className="mx-5 mt-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] p-3 text-sm text-[#A35F37]">{error}</p>}
      {syncNotice && <p className="mx-5 mt-5 rounded-xl border border-[#D9E5DB] bg-[#EEF5EF] p-3 text-sm text-[#477154]">{syncNotice}</p>}
      {!archived && !sourceSpreadsheetUrl && <p className="mx-5 mt-5 rounded-xl border border-[#E1DED8] bg-[#F7F5F2] p-3 text-sm text-[#6F6960]">請先在「檔期設定」填入 Google 試算表連結，才能同步商品。</p>}
      {!archived && open && (
        <form onSubmit={save} className="grid gap-3 border-b border-[#F0EDE8] p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">商品名稱<input required value={form.name} onChange={(event) => update("name", event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 font-normal" /></label>
          <label className="text-sm font-semibold">國家<select value={form.country} onChange={(event) => update("country", event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 font-normal"><option>韓國</option><option>日本</option><option>大陸</option><option>台灣</option><option>其他</option></select></label>
          <label className="text-sm font-semibold">商品分類<input value={form.category} onChange={(event) => update("category", event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 font-normal" /></label>
          <label className="text-sm font-semibold">商品子分類<input value={form.subcategory} onChange={(event) => update("subcategory", event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 font-normal" /></label>
          <label className="text-sm font-semibold">商品規格<input value={form.specification} onChange={(event) => update("specification", event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 font-normal" /></label>
          <label className="text-sm font-semibold">當地價格<div className="relative mt-2"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-bold text-[#635D55]">{currencySymbol}</span><input required type="number" min="0" value={form.localPrice} onChange={(event) => update("localPrice", event.target.value)} className="h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] pl-12 pr-3 font-normal" /></div></label>
          <label className="text-sm font-semibold">台幣成本<input required type="number" min="0" value={form.cost} onChange={(event) => update("cost", event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 font-normal" /></label>
          <label className="text-sm font-semibold">一般售價<input required type="number" min="0" value={form.retailPrice} onChange={(event) => update("retailPrice", event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 font-normal" /></label>
          <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">備註<input value={form.note} onChange={(event) => update("note", event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 font-normal" /></label>
          <div className="flex items-end justify-end"><button disabled={saving} className={button}>{saving ? "儲存中…" : form.id ? "儲存修改" : "新增檔期商品"}</button></div>
        </form>
      )}
      <div className="grid gap-2 border-b border-[#F0EDE8] p-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="sr-only" htmlFor="live-product-search">搜尋檔期商品</label>
        <input
          id="live-product-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜尋商品名稱、分類或規格"
          className="h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm"
        />
        <label className="sr-only" htmlFor="live-product-category">篩選產品分類</label>
        <select
          id="live-product-category"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm"
        >
          <option value="">全部產品分類</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>
      <div className="divide-y divide-[#F0EDE8]">
        {visibleProducts.length ? visibleProducts.map((product) => (
          <article key={product.id} className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
            <span className="min-w-0 flex-1"><b className="block truncate text-sm">{product.name}</b><small className="mt-1 block truncate text-xs text-[#8D877E]">{[product.country, product.category, product.subcategory, product.specification].filter(Boolean).join(" · ") || "尚未填寫分類或規格"}</small></span>
            <span className="text-right text-xs text-[#6F6960]">當地 {localCurrency[product.country] ?? "$"} {Number(product.local_price).toLocaleString("zh-TW")}<br />成本 {money(product.cost)} · 售價 {money(product.retail_price)}</span>
            {product.promoted_product_id ? <span className="rounded-full bg-[#E7F0E8] px-2.5 py-1 text-[11px] font-semibold text-[#477154]">已轉正式商品</span> : !archived && <span className="flex gap-2"><button type="button" onClick={() => edit(product)} className="text-sm font-semibold text-[#5E7665]">修改</button><button type="button" onClick={() => void remove(product)} className="text-sm font-semibold text-[#A35F37]">刪除</button></span>}
          </article>
        )) : <p className="p-8 text-center text-sm text-[#8D877E]">{products.length ? "沒有符合目前搜尋或產品分類篩選的商品。" : "尚未建立檔期商品；可在客人喊單前先暫存品項。"}</p>}
      </div>
    </section>
  );
}

function CampaignDetailPage({
  campaignId,
  catalog,
  openOrder,
  openProduct,
  back,
  onDeleted,
}: {
  campaignId: string;
  catalog: Product[];
  openOrder: (id: string) => void;
  openProduct: (id: string) => void;
  back: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [inbox, setInbox] = useState<Inbox[]>([]);
  const [liveProducts, setLiveProducts] = useState<LiveSaleProduct[]>([]);
  const [editor, setEditor] = useState<{
    claim?: Claim;
    inbox?: Inbox | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [deletingInboxId, setDeletingInboxId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Campaign["status"]>("進行中");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [sourceSpreadsheetUrl, setSourceSpreadsheetUrl] = useState("");
  const [showCampaignSettings, setShowCampaignSettings] = useState(false);
  const [showLiveProducts, setShowLiveProducts] = useState(false);
  const [claimSearch, setClaimSearch] = useState("");
  const [procurementSearch, setProcurementSearch] = useState("");
  const [receivedDrafts, setReceivedDrafts] = useState<Record<string, string>>({});
  const [receivingProductId, setReceivingProductId] = useState("");
  const catalogById = useMemo(
    () => new Map(catalog.map((item) => [String(item.id), item])),
    [catalog],
  );
  const liveProductById = useMemo(
    () => new Map(liveProducts.map((item) => [item.id, item])),
    [liveProducts],
  );
  const orderNetProfit = useMemo(() => {
    let total = 0;
    let hasUnmatchedCost = false;
    for (const claim of detail?.claims ?? []) {
      if (!(["待結帳", "已結帳", "已轉訂單"] as ClaimStatus[]).includes(claim.status)) continue;
      for (const item of claim.items) {
        const product = item.product_id ? catalogById.get(item.product_id) : undefined;
        const liveProduct = item.live_sale_product_id ? liveProductById.get(item.live_sale_product_id) : undefined;
        const cost = product?.cost ?? liveProduct?.cost;
        if (cost === undefined) {
          hasUnmatchedCost = true;
          continue;
        }
        total += (item.unit_price - cost) * item.quantity;
      }
    }
    return hasUnmatchedCost ? null : total;
  }, [catalogById, detail?.claims, liveProductById]);

  const load = async () => {
    setLoading(true);
    try {
      const [detailResponse, inboxResponse, liveProductsResponse] = await Promise.all([
        fetch(`/api/live-sale/campaigns/${campaignId}`),
        fetch(
          `/api/live-sale/inbox?status=%E5%BE%85%E8%99%95%E7%90%86&campaignId=${encodeURIComponent(campaignId)}`,
        ),
        fetch(`/api/live-sale/campaigns/${campaignId}/products`),
      ]);
      const [detailData, inboxData, liveProductsData] = await Promise.all([
        detailResponse.json(),
        inboxResponse.json(),
        liveProductsResponse.json(),
      ]);
      if (!detailResponse.ok)
        throw new Error(detailData.message ?? "無法讀取連線檔期。");
      if (!inboxResponse.ok)
        throw new Error(inboxData.message ?? "無法讀取 LINE 私訊。");
      if (!liveProductsResponse.ok)
        throw new Error(liveProductsData.message ?? "無法讀取檔期商品。");
      const next = detailData as Detail;
      setDetail(next);
      setInbox(inboxData.inbox ?? []);
      setLiveProducts(liveProductsData.products ?? []);
      setName(next.campaign.name);
      setStatus(next.campaign.status);
      setStartDate(next.campaign.start_date);
      setEndDate(next.campaign.end_date ?? "");
      setNote(next.campaign.note);
      setSourceSpreadsheetUrl(next.campaign.source_spreadsheet_url ?? "");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法讀取連線檔期。");
    } finally {
      setLoading(false);
    }
  };
  const saveReceivedQuantity = async (line: Procurement, value: string) => {
    if (!line.productId || line.receivedQuantity === null) return;
    const receivedQuantity = Number(value);
    if (!Number.isInteger(receivedQuantity) || receivedQuantity < 0) {
      setError("到貨數量請填寫零或正整數。");
      setReceivedDrafts((current) => ({ ...current, [line.productId!]: String(line.receivedQuantity) }));
      return;
    }
    if (receivedQuantity === line.receivedQuantity) return;
    setReceivingProductId(line.productId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/live-sale/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateReceived", productId: line.productId, receivedQuantity }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法更新到貨數量。");
      setReceivedDrafts((current) => ({ ...current, [line.productId!]: String(receivedQuantity) }));
      setNotice("已更新累計到貨數量，商品資料庫可售庫存也已同步。" );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法更新到貨數量。");
      setReceivedDrafts((current) => ({ ...current, [line.productId!]: String(line.receivedQuantity) }));
    } finally {
      setReceivingProductId("");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCustomers([]);
      setCustomersLoaded(false);
      setReceivedDrafts({});
      setClaimSearch("");
      setProcurementSearch("");
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // 只在切換檔期時重讀資料；load 會同步本次檔期的內容。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);
  const openEditor = async (value: { claim?: Claim; inbox?: Inbox | null }) => {
    setOpening(true);
    try {
      if (!customersLoaded) {
        const response = await fetch("/api/customers");
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.message ?? "無法讀取客戶資料。");
        setCustomers(result.customers ?? []);
        setCustomersLoaded(true);
      }
      setEditor(value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法開啟喊單。");
    } finally {
      setOpening(false);
    }
  };
  const deleteInbox = async (item: Inbox) => {
    if (detail?.campaign.status === "已封存") {
      setError("此連線檔期已封存，LINE 私訊僅供查看，無法修改。");
      return;
    }
    if (!window.confirm("確定刪除這則待確認 LINE 私訊？此動作無法復原。")) return;
    setDeletingInboxId(item.id);
    setError("");
    try {
      const response = await fetch("/api/live-sale/inbox", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法刪除 LINE 私訊。");
      setInbox((current) => current.filter((currentItem) => currentItem.id !== item.id));
      setNotice("LINE 私訊已刪除。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法刪除 LINE 私訊。");
    } finally {
      setDeletingInboxId("");
    }
  };
  const action = async (claim: Claim, actionName: ActionName) => {
    if (detail?.campaign.status === "已封存") {
      setError("此連線檔期已封存，喊單僅供查看，無法修改。");
      return;
    }
    const message =
      actionName === "convert"
        ? `確認把 ${claim.claim_number} 重新轉為一般訂單？`
        : actionName === "cancel"
          ? `確定取消 ${claim.claim_number}？`
          : actionName === "delete"
            ? claim.converted_order_id
              ? `確定刪除 ${claim.claim_number} 與它尚未出貨的已結單？`
              : `確定刪除 ${claim.claim_number}？`
            : actionName === "markPaid"
              ? `確認結單 ${claim.claim_number}？系統會立即建立連線專用的一般訂單，移至「已結單」。轉單後請由人員手動確認匯款、付款狀態與配送／出貨方式。`
              : "";
    if (message && !window.confirm(message)) return;
    const response = await fetch(`/api/live-sale/claims/${claim.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionName }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? "無法更新喊單。");
      return;
    }
    if (actionName === "markPaid" || actionName === "convert") {
      setNotice(
        `已結單並建立一般訂單 ${result.order?.order_number ?? ""}；請在「已結單」開啟訂單，手動確認匯款、付款狀態與配送／出貨方式。`,
      );
    } else if (actionName === "delete") setNotice("喊單已刪除。");
    else setNotice("喊單狀態已更新。");
    await load();
    setEditor(null);
  };
  const saveCampaign = async () => {
    if (detail?.campaign.status === "已封存") {
      setError("此連線檔期已封存，檔期設定僅供查看，無法修改。");
      return;
    }
    const response = await fetch(`/api/live-sale/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateCampaign",
        name,
        status,
        startDate,
        endDate: endDate || undefined,
        note,
        sourceSpreadsheetUrl,
      }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.message ?? "無法更新檔期。");
    else {
      setNotice(
        result.clearedLiveProductCount
          ? `檔期已封存，並清除了 ${result.clearedLiveProductCount} 項未被喊單的暫存商品。`
          : "檔期資訊已更新。",
      );
      await load();
    }
  };
  const deleteCampaign = async () => {
    if (
      !detail ||
      !window.confirm(`確定刪除空白檔期「${detail.campaign.name}」嗎？`)
    )
      return;
    const response = await fetch(`/api/live-sale/campaigns/${campaignId}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok) setError(result.message ?? "無法刪除檔期。");
    else await onDeleted();
  };

  if (loading)
    return (
      <p className="py-10 text-center text-sm text-[#8D877E]">
        載入連線檔期中…
      </p>
    );
  if (!detail)
    return (
      <>
        <button onClick={back} className="text-sm font-semibold text-[#5E7665]">
          ← 返回連線檔期
        </button>
        <p className="mt-5 text-sm text-[#A35F37]">
          {error || "找不到連線檔期。"}
        </p>
      </>
    );
  if (editor)
    return (
      <ClaimEditor
        campaignId={campaignId}
        campaignArchived={detail.campaign.status === "已封存"}
        catalog={catalog}
        liveProducts={liveProducts}
        customers={customers}
        initial={editor.claim}
        inbox={editor.inbox}
        onCancel={() => setEditor(null)}
        onSaved={async () => {
          setEditor(null);
          setNotice(
            editor.claim
              ? "喊單已更新；同客戶的未結單已自動合併。"
              : "已建立／合併喊單。",
          );
          await load();
        }}
        onAction={action}
        openOrder={openOrder}
        onCustomerCreated={(customer) => {
          setCustomers((current) => [
            customer,
            ...current.filter((item) => item.id !== customer.id),
          ]);
          setCustomersLoaded(true);
        }}
      />
    );

  const { campaign, claims, summary, procurement } = detail;
  const campaignArchived = campaign.status === "已封存";
  const claimKeyword = claimSearch.trim().toLocaleLowerCase("zh-TW");
  const visibleClaims = claims.filter((claim) => {
    if (claim.status === "已轉訂單") return false;
    if (!claimKeyword) return true;
    return [claim.claim_number, claim.customer_name, claim.line_name]
      .join(" ")
      .toLocaleLowerCase("zh-TW")
      .includes(claimKeyword);
  });
  const visibleProcurement = procurement.filter((line) => {
    const keyword = procurementSearch.trim().toLocaleLowerCase();
    return !keyword || [line.productName, line.specification, line.category]
      .join(" ")
      .toLocaleLowerCase()
      .includes(keyword);
  });
  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <button
            onClick={back}
            className="text-sm font-semibold text-[#5E7665]"
          >
            ← 返回連線檔期
          </button>
          <p className="mt-5 text-[11px] font-bold tracking-[.18em] text-[#A09A90]">
            LIVE SALE CAMPAIGN
          </p>
          <h1 className="mt-2 text-[29px] font-semibold">{campaign.name}</h1>
          <p className="mt-2 text-sm text-[#7B766E]">
            檔期編號 {campaign.campaign_code} · {day(campaign.start_date)} 開始
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowLiveProducts((visible) => !visible)}
            className={`${secondary} h-11 w-[120px] px-2`}
            aria-expanded={showLiveProducts}
            aria-controls="campaign-products"
          >
            檔期商品庫
          </button>
          <button
            type="button"
            onClick={() => setShowCampaignSettings((visible) => !visible)}
            className={`${secondary} h-11 w-[120px] px-2`}
            aria-expanded={showCampaignSettings}
            aria-controls="campaign-settings"
          >
            檔期設定
          </button>
          <button
            onClick={() => void openEditor({ inbox: null })}
            disabled={campaign.status === "已封存" || opening}
            className={`${button} h-11 w-[120px] px-2`}
          >
            {opening ? "準備中…" : "建立喊單"}
          </button>
        </div>
      </div>
      {error && (
        <p className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] p-3 text-sm text-[#A35F37]">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-5 rounded-xl border border-[#D9E5DB] bg-[#EEF5EF] p-3 text-sm text-[#477154]">
          {notice}
        </p>
      )}
      {showCampaignSettings && <section id="campaign-settings" className="mb-5 rounded-2xl border border-[#E9E5DF] bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">CAMPAIGN SETTINGS</p>
            <h2 className="mt-1 text-lg font-semibold">檔期設定</h2>
          </div>
          <button type="button" onClick={() => setShowCampaignSettings(false)} className="text-sm font-semibold text-[#5E7665]">收合</button>
        </div>
        {campaignArchived && (
          <p className="mb-4 rounded-xl border border-[#E1DED8] bg-[#F7F5F2] p-3 text-sm text-[#6F6960]">
            此檔期已封存，設定與喊單資料僅供查看。
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="text-sm font-semibold">
            檔期名稱
            <input
              disabled={campaignArchived}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            開始日期
            <input
              disabled={campaignArchived}
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            結束日期
            <input
              disabled={campaignArchived}
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold">
            檔期狀態
            <select
              disabled={campaignArchived}
              value={status}
              onChange={(event) => setStatus(event.target.value as Campaign["status"])}
              className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal"
            >
              <option>進行中</option>
              <option>已結單</option>
              <option>已封存</option>
            </select>
          </label>
          <label className="text-sm font-semibold lg:col-span-3">
            檔期備註
            <input
              disabled={campaignArchived}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold lg:col-span-3">
            Google 試算表連結（可多個）
            <textarea
              disabled={campaignArchived}
              value={sourceSpreadsheetUrl}
              onChange={(event) => setSourceSpreadsheetUrl(event.target.value)}
              placeholder={"每行貼上一個工作表連結\nhttps://docs.google.com/spreadsheets/d/.../edit?gid=0"}
              rows={3}
              className="mt-2 w-full rounded-xl border border-[#E6E1DB] px-3 py-2 font-normal"
            />
            <small className="mt-1 block font-normal text-xs text-[#8D877E]">每一行可貼上同一份或不同試算表的工作表連結；系統會依商品名稱與規格略過重複資料。</small>
          </label>
          <div className="flex flex-wrap items-end justify-end gap-2">
            <button disabled={campaignArchived} onClick={() => void saveCampaign()} className={`${secondary} disabled:opacity-45`}>
              儲存檔期設定
            </button>
            <button
              onClick={() => void deleteCampaign()}
              disabled={campaignArchived || summary.claimCount > 0}
              className="inline-flex h-10 items-center rounded-xl border border-[#F0D6C2] bg-white px-3 text-sm font-semibold text-[#A35F37] disabled:opacity-45"
            >
              刪除空白檔期
            </button>
          </div>
        </div>
      </section>}
      {showLiveProducts && <div id="campaign-products"><LiveSaleProductPanel campaignId={campaignId} archived={campaignArchived} products={liveProducts} sourceSpreadsheetUrl={campaign.source_spreadsheet_url ?? ""} onChanged={load} /></div>}
      <section className="mb-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
        <div className="border-b border-[#F0EDE8] p-5">
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">
            LINE DIRECT MESSAGES
          </p>
          <h2 className="mt-1 text-lg font-semibold">待確認 LINE 私訊</h2>
          <p className="mt-1 text-xs text-[#8D877E]">
            所有連線期間的 LINE 喊單會先留在這裡；人員確認客戶與商品後，才會自動併入同檔期、同客戶的未結單。
          </p>
        </div>
        {inbox.length ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {inbox.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-[#E9E5DF] bg-[#FCFBF9] p-4"
              >
                <p className="whitespace-pre-wrap text-sm font-semibold">
                  {item.message_text}
                </p>
                <p className="mt-3 text-xs text-[#8D877E]">
                  {item.matched_customer
                    ? `已配對：${item.matched_customer.name}${item.matched_customer.line_name ? ` · ${item.matched_customer.line_name}` : ""}`
                    : item.line_display_name
                      ? `LINE@ 名稱：${item.line_display_name}`
                      : "尚未配對客戶"}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    onClick={() => void openEditor({ inbox: item })}
                    disabled={deletingInboxId === item.id}
                    className="text-sm font-semibold text-[#5E7665] disabled:opacity-45"
                  >
                    {campaignArchived ? "查看內容 →" : "建立／核對喊單 →"}
                  </button>
                  {!campaignArchived && (
                    <button
                      onClick={() => void deleteInbox(item)}
                      disabled={deletingInboxId === item.id}
                      className="text-sm font-semibold text-[#B35B3B] disabled:opacity-45"
                    >
                      {deletingInboxId === item.id ? "刪除中…" : "刪除"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-sm text-[#8D877E]">
            目前沒有待處理的 LINE 私訊。
          </p>
        )}
      </section>
      <section className="mt-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EDE8] p-5">
          <div>
            <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">
              CLAIMS
            </p>
            <h2 className="mt-1 text-lg font-semibold">未結單</h2>
          </div>
          <div className="flex gap-2">
            <span className={button}>未結單</span>
            <a href={`/live-sale-orders?campaignId=${encodeURIComponent(campaign.id)}`} className={secondary}>
              已結單 →
            </a>
          </div>
        </div>
        <div className="border-b border-[#F0EDE8] px-5 py-3">
          <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#928C84] md:max-w-sm">
            ⌕
            <input
              value={claimSearch}
              onChange={(event) => setClaimSearch(event.target.value)}
              placeholder="搜尋喊單編號、客戶或 LINE@ 名稱"
              className="min-w-0 flex-1 bg-transparent text-[#58534C] outline-none"
            />
          </label>
        </div>
        <div className="divide-y divide-[#F0EDE8] md:hidden">
          {visibleClaims.length ? (
            visibleClaims.map((claim) => (
              <article key={claim.id} onClick={() => void openEditor({ claim })} className="grid min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 px-3 py-2.5 hover:bg-[#FCFBF9]">
                <span className="flex min-w-0 items-center gap-2">
                  <b className="shrink-0 whitespace-nowrap text-[15px] tracking-[-.02em] text-[#5E7665]">{claim.claim_number}</b>
                  <span className="min-w-0 truncate text-[15px] font-extrabold leading-none text-[#403C36]">{claim.customer_name || "未配對客戶"}{claim.line_name ? <small className="ml-1 text-[11px] font-medium text-[#938D84]">（{claim.line_name}）</small> : null}</span>
                </span>
                <b className="justify-self-end whitespace-nowrap text-sm text-[#403C36]">{money(claim.claim_total)}</b>
                <span className="justify-self-end"><Pill status={claim.status} /></span>
              </article>
            ))
          ) : (
            <p className="p-10 text-center text-[#8D877E]">尚未建立未結單。</p>
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]">
              <tr>
                <th className="px-5 py-3">喊單編號</th>
                <th className="px-3 py-3">客戶名稱</th>
                <th className="px-3 py-3">訂單狀態</th>
                <th className="px-3 py-3">總金額</th>
                <th className="px-3 py-3">訂單淨利</th>
                <th className="px-5 py-3 text-right">完整訂單</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDE8]">
              {visibleClaims.length ? (
                visibleClaims.map((claim) => {
                  const claimProfit = claim.items.reduce<number | null>(
                    (sum, item) => {
                      const product = item.product_id
                        ? catalogById.get(item.product_id)
                        : undefined;
                      return sum === null || !product
                        ? null
                        : sum +
                            (item.unit_price - product.cost) * item.quantity;
                    },
                    0,
                  );
                  return (
                    <tr key={claim.id} onClick={() => void openEditor({ claim })} className="cursor-pointer hover:bg-[#FCFBF9]">
                      <td className="px-5 py-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => void openEditor({ claim })}
                          className="text-left text-[#5E7665] hover:underline"
                        >
                          {claim.claim_number}
                        </button>
                      </td>
                      <td className="px-3 py-4">
                        <span>{claim.customer_name || "未配對客戶"}</span>{claim.line_name ? <small className="ml-1 text-xs text-[#938D84]">（{claim.line_name}）</small> : null}
                      </td>
                      <td className="px-3 py-4">
                        <Pill status={claim.status} />
                      </td>
                      <td className="px-3 py-4 font-semibold">
                        {money(claim.claim_total)}
                      </td>
                      <td
                        className={`px-3 py-4 font-semibold ${claimProfit === null ? "text-[#928C83]" : claimProfit < 0 ? "text-[#A66932]" : "text-[#477154]"}`}
                      >
                        {claimProfit === null ? "待核對" : money(claimProfit)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => void openEditor({ claim })}
                          className="text-sm font-semibold text-[#5E7665]"
                        >
                          展開完整訂單 →
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-[#8D877E]">
                    尚未建立未結單。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <div className="mt-5 grid grid-cols-4 gap-1.5 sm:gap-3">
        <Metric
          label="目前連線業績"
          value={money(summary.activeAmount)}
          note="未取消喊單總額"
          compact
        />
        <Metric
          label="目前訂單淨利"
          value={orderNetProfit === null ? "待核對" : money(orderNetProfit)}
          note="未結單＋已結單"
          compact
        />
        <Metric
          label="喊單筆數"
          value={`${summary.claimCount} 筆`}
          note={
            summary.unresolvedCount
              ? `${summary.unresolvedCount} 筆待核對`
              : "皆已核對"
          }
          compact
        />
        <Metric
          label="採購商品"
          value={`${procurement.length} 項`}
          note="依商品與規格彙整"
          compact
        />
      </div>
      <section className="mt-5 overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
        <div className="border-b border-[#F0EDE8] p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">
                PURCHASING SUMMARY
              </p>
              <h2 className="mt-1 text-lg font-semibold">商品採購與缺貨統整</h2>
              <p className="mt-1 text-xs text-[#8D877E]">
                可直接填寫累計到貨數量；系統會同步更新商品資料庫的可售庫存與庫存異動紀錄。
              </p>
            </div>
            <label className="w-full sm:w-72">
              <span className="sr-only">搜尋採購商品</span>
              <input
                value={procurementSearch}
                onChange={(event) => setProcurementSearch(event.target.value)}
                placeholder="搜尋商品、分類或規格"
                className="h-10 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm"
              />
            </label>
          </div>
        </div>
        <div className="divide-y divide-[#F0EDE8] md:hidden">
          {visibleProcurement.length ? visibleProcurement.map((line) => (
            <div
              key={line.productId ?? `${line.productName}-${line.specification}`}
              role={line.productId ? "link" : undefined}
              tabIndex={line.productId ? 0 : undefined}
              onClick={() => line.productId && openProduct(line.productId)}
              onKeyDown={(event) => {
                if (line.productId && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  openProduct(line.productId);
                }
              }}
              className={`grid min-w-0 grid-cols-[minmax(0,1fr)_92px] items-center gap-3 px-3 py-3 ${line.productId ? "cursor-pointer hover:bg-[#FCFBF9] focus:outline-none focus-visible:bg-[#F3F7F3]" : ""}`}
            >
              <span className="min-w-0"><b className="block truncate text-sm">{line.productName}</b><small className="block truncate text-xs text-[#8D877E]">{[line.category, line.specification].filter(Boolean).join(" · ") || "待確認商品"}</small><small className="mt-1 block text-xs text-[#817B72]">需求 {line.demandQuantity} · 可售 {line.availableQuantity ?? "—"} · {line.purchaseQuantity === null ? "待核對" : line.purchaseQuantity ? `需採 ${line.purchaseQuantity}` : "供應足夠"}</small></span>
              {line.productId && line.receivedQuantity !== null ? (
                <label onClick={(event) => event.stopPropagation()} className="text-right text-[11px] font-semibold text-[#6F6960]">到貨累計
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    disabled={campaignArchived || receivingProductId === line.productId}
                    value={receivedDrafts[line.productId] ?? String(line.receivedQuantity)}
                    onChange={(event) => setReceivedDrafts((current) => ({ ...current, [line.productId!]: event.target.value }))}
                    onBlur={(event) => void saveReceivedQuantity(line, event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E6E1DB] bg-[#FCFBF9] px-2 text-right text-sm font-semibold text-[#403C36] disabled:opacity-50"
                  />
                </label>
              ) : <span className="text-right text-xs text-[#8D877E]">請先核對商品</span>}
            </div>
          )) : <p className="p-8 text-center text-sm text-[#8D877E]">{procurement.length ? "沒有符合搜尋條件的商品。" : "建立喊單後，這裡會依商品規格自動統整採購數量。"}</p>}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-[#FBFAF8] text-[11px] text-[#928C83]">
              <tr>
                <th className="px-5 py-3">商品／規格</th>
                <th className="px-3 py-3">喊單需求</th>
                <th className="px-3 py-3">到貨累計</th>
                <th className="px-3 py-3">商品資料庫可售庫存</th>
                <th className="px-3 py-3">需採購</th>
                <th className="px-3 py-3">已結單</th>
                <th className="px-3 py-3">待核對</th>
                <th className="px-3 py-3">目前不足／需通知客人</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDE8]">
              {visibleProcurement.length ? (
                visibleProcurement.map((line) => (
                  <tr
                    key={
                      line.productId ??
                      `${line.productName}-${line.specification}`
                    }
                    onClick={() => line.productId && openProduct(line.productId)}
                    onKeyDown={(event) => {
                      if (line.productId && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        openProduct(line.productId);
                      }
                    }}
                    tabIndex={line.productId ? 0 : undefined}
                    className={line.productId ? "cursor-pointer hover:bg-[#FCFBF9] focus:outline-none focus-visible:bg-[#F3F7F3]" : undefined}
                  >
                    <td className="px-5 py-4">
                      <b>{line.productName}</b>
                      <small className="mt-1 block text-xs text-[#8D877E]">
                        {[line.category, line.specification]
                          .filter(Boolean)
                          .join(" · ") || "待確認商品"}
                      </small>
                    </td>
                    <td className="px-3 py-4 font-semibold">
                      {line.demandQuantity}
                    </td>
                    <td className="px-3 py-4">
                      {line.productId && line.receivedQuantity !== null ? (
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          aria-label={`${line.productName} 累計到貨數量`}
                          onClick={(event) => event.stopPropagation()}
                          disabled={campaignArchived || receivingProductId === line.productId}
                          value={receivedDrafts[line.productId] ?? String(line.receivedQuantity)}
                          onChange={(event) => setReceivedDrafts((current) => ({ ...current, [line.productId!]: event.target.value }))}
                          onBlur={(event) => void saveReceivedQuantity(line, event.target.value)}
                          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                          className="h-10 w-24 rounded-lg border border-[#E6E1DB] bg-[#FCFBF9] px-2 text-right font-semibold disabled:opacity-50"
                        />
                      ) : <span className="text-[#8D877E]">請先核對</span>}
                    </td>
                    <td className="px-3 py-4">
                      {line.availableQuantity === null
                        ? "待核對商品"
                        : line.availableQuantity}
                    </td>
                    <td className="px-3 py-4 font-semibold text-[#A35F37]">
                      {line.purchaseQuantity === null
                        ? "—"
                        : line.purchaseQuantity}
                    </td>
                    <td className="px-3 py-4 text-[#477154]">
                      {line.paidQuantity}
                    </td>
                    <td className="px-3 py-4 text-[#A66932]">
                      {line.unresolvedQuantity || "—"}
                    </td>
                    <td className="px-3 py-4">
                      {line.shortageQuantity === null ? (
                        <span className="text-[#8D877E]">請先核對商品</span>
                      ) : line.shortageQuantity ? (
                        <div>
                          <b className="text-[#A35F37]">
                            缺 {line.shortageQuantity}
                          </b>
                          <p className="mt-1 max-w-xs text-xs text-[#7E6657]">
                            {line.affectedCustomers
                              .map(
                                (person) =>
                                  `${person.customerName}（${person.quantity}）`,
                              )
                              .join("、")}
                          </p>
                        </div>
                      ) : (
                        <span className="font-semibold text-[#477154]">
                          供應足夠
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-[#8D877E]">
                    {procurement.length ? "沒有符合搜尋條件的商品。" : "建立喊單後，這裡會依商品規格自動統整採購數量。"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function LiveSalePage({
  catalog,
  openOrder,
  openProduct,
  back,
  initialCampaignId = "",
}: {
  catalog: Product[];
  openOrder: (id: string) => void;
  openProduct: (id: string) => void;
  back: () => void;
  initialCampaignId?: string;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    campaignCode: "",
    startDate: new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Taipei",
    }),
    endDate: "",
    note: "",
  });
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/live-sale/campaigns");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法讀取連線檔期。");
      const loadedCampaigns = result.campaigns ?? [];
      setCampaigns(loadedCampaigns);
      const requestedCampaign = loadedCampaigns.find(
        (campaign: Campaign) => campaign.id === initialCampaignId || campaign.campaign_code === initialCampaignId,
      );
      if (requestedCampaign) setSelected(requestedCampaign.id);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法讀取連線檔期。");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // 首次進入時載入連線檔期清單。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const requestedCampaign = campaigns.find(
      (campaign) => campaign.id === initialCampaignId || campaign.campaign_code === initialCampaignId,
    );
    if (requestedCampaign) {
      setSelected(requestedCampaign.id);
    }
  }, [campaigns, initialCampaignId]);
  const create = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/live-sale/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法建立連線檔期。");
      setCreating(false);
      setSelected(result.campaign.id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法建立連線檔期。");
    } finally {
      setSaving(false);
    }
  };
  if (selected)
    return (
      <CampaignDetailPage
        campaignId={selected}
        catalog={catalog}
        openOrder={openOrder}
        openProduct={openProduct}
        back={() => {
          setSelected("");
          void load();
        }}
        onDeleted={async () => {
          setSelected("");
          await load();
        }}
      />
    );
  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <button
            onClick={back}
            className="text-sm font-semibold text-[#5E7665]"
          >
            ← 返回一般訂單
          </button>
          <p className="mt-5 text-[11px] font-bold tracking-[.18em] text-[#A09A90]">
            LIVE SALES
          </p>
          <h1 className="mt-2 text-[29px] font-semibold">連線檔期</h1>
          <p className="mt-2 text-sm text-[#7B766E]">
            LINE
            私訊喊單與一般訂單分開管理；確認結單後會建立一般訂單並保留在本檔期，付款與配送由人員後續確認。
          </p>
        </div>
        <button
          onClick={() => setCreating((value) => !value)}
          className={button}
        >
          ＋ 新增連線檔期
        </button>
      </div>
      {error && (
        <p className="mb-5 rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] p-3 text-sm text-[#A35F37]">
          {error}
        </p>
      )}
      {creating && (
        <form
          onSubmit={create}
          className="mb-5 rounded-2xl border border-[#D9E5DB] bg-[#F6FAF6] p-5"
        >
          <h2 className="text-lg font-semibold">建立連線檔期資料夾</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-semibold">
              檔期名稱
              <input
                required
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              獨立檔期編號
              <input
                required
                value={draft.campaignCode}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    campaignCode: event.target.value.toUpperCase(),
                  })
                }
                className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              開始日期
              <input
                required
                type="date"
                value={draft.startDate}
                onChange={(event) =>
                  setDraft({ ...draft, startDate: event.target.value })
                }
                className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              結單日期
              <input
                type="date"
                value={draft.endDate}
                onChange={(event) =>
                  setDraft({ ...draft, endDate: event.target.value })
                }
                className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal"
              />
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold">
            檔期備註
            <input
              value={draft.note}
              onChange={(event) =>
                setDraft({ ...draft, note: event.target.value })
              }
              className="mt-2 h-10 w-full rounded-xl border border-[#E6E1DB] px-3 font-normal"
            />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className={secondary}
            >
              取消
            </button>
            <button disabled={saving} className={button}>
              {saving ? "建立中…" : "建立檔期"}
            </button>
          </div>
        </form>
      )}
      <section className="overflow-hidden rounded-2xl border border-[#E9E5DF] bg-white">
        <div className="border-b border-[#F0EDE8] p-5">
          <p className="text-[11px] font-bold tracking-[.16em] text-[#A09A90]">
            CAMPAIGN FOLDERS
          </p>
          <h2 className="mt-1 text-lg font-semibold">連線檔期列表</h2>
        </div>
        {loading ? (
          <p className="p-10 text-center text-sm text-[#8D877E]">
            載入連線檔期中…
          </p>
        ) : campaigns.length ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() => setSelected(campaign.id)}
                className="rounded-2xl border border-[#E9E5DF] bg-[#FCFBF9] p-5 text-left hover:border-[#B7CEBA]"
              >
                <p className="text-[11px] font-bold tracking-[.16em] text-[#8F998F]">
                  {campaign.campaign_code}
                </p>
                <h3 className="mt-2 text-lg font-semibold">{campaign.name}</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric
                    label="連線業績"
                    value={money(campaign.summary.activeAmount)}
                    note="未取消喊單"
                  />
                  <Metric
                    label="已結單"
                    value={money(campaign.summary.paidAmount)}
                    note={`${campaign.summary.claimCount} 筆喊單`}
                  />
                </div>
                <p className="mt-4 text-xs text-[#8D877E]">
                  {day(campaign.start_date)} 起
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="p-10 text-center text-sm text-[#8D877E]">
            尚未建立連線檔期。
          </p>
        )}
      </section>
    </>
  );
}
