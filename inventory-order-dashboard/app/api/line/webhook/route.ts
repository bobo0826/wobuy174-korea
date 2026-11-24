import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: { type?: string; userId?: string; groupId?: string; roomId?: string };
  message?: { type?: string; id?: string; text?: string };
};

type LineWebhookBody = { events?: LineEvent[] };

type ProductDraft = {
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
  safety_stock: number;
};

const fieldAliases: Record<keyof ProductDraft, string[]> = {
  sku: ["商品編號", "貨號", "sku"],
  name: ["商品名稱", "名稱"],
  country: ["國家"],
  category: ["商品分類", "商品種類", "分類"],
  subcategory: ["商品子分類", "子分類"],
  specification: ["商品規格", "規格"],
  note: ["備註"],
  cost: ["最新成本", "成本"],
  local_price: ["當地價格", "當地成本"],
  staff_price: ["員工價"],
  retail_price: ["一般售價", "零售價", "售價"],
  available_stock: ["可售庫存", "初始庫存", "庫存"],
  safety_stock: ["安全庫存"],
};

const template = `直接複製後填寫：
新增商品
商品名稱：
國家：韓國
最新成本：
當地價格：
一般售價：

以上五項必填，價格只填數字即可。商品會先存入目前連線檔期的暫存商品庫；客人確認喊單後才會建立正式商品與貨號。

需要時再自行加上：商品分類、商品規格、備註。`;

const normalize = (value: string) => value.trim().toLowerCase().replaceAll(/\s/g, "");
const normalizeProductLabel = (value: string) => normalize(value).replaceAll(/[｜|·・/／_－-]/g, "");

function allowedUserIds() {
  return new Set(
    (process.env.LINE_ALLOWED_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

function isAuthorizationIdRequest(text: string) {
  return normalize(text) === normalize("查詢商品上傳 ID");
}

function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}

function parseProduct(text: string): { product?: ProductDraft; error?: string } {
  const values = new Map<string, string>();
  const aliasMap = new Map<string, keyof ProductDraft>();
  for (const [field, aliases] of Object.entries(fieldAliases) as Array<[keyof ProductDraft, string[]]>) {
    for (const alias of aliases) aliasMap.set(normalize(alias), field);
  }

  for (const line of text.replace(/\r/g, "").split("\n")) {
    const match = line.match(/^\s*([^：:]+?)\s*[：:]\s*(.*?)\s*$/);
    if (!match) continue;
    const field = aliasMap.get(normalize(match[1]));
    if (field) values.set(field, match[2]);
  }

  const required = ["name", "country", "cost", "local_price", "retail_price"] as const;
  const missing = required.filter((field) => !values.get(field)?.trim());
  if (missing.length) {
    const labels: Record<(typeof required)[number], string> = { name: "商品名稱", country: "國家", cost: "最新成本", local_price: "當地價格", retail_price: "一般售價" };
    return { error: `缺少：${missing.map((field) => labels[field]).join("、")}。\n\n${template}` };
  }

  const number = (field: keyof ProductDraft) => {
    const raw = values.get(field) ?? "0";
    if (field === "local_price") return /^\d+(?:\.\d{1,2})?$/.test(raw.trim()) ? Number(raw) : null;
    if (!/^\d+$/.test(raw.trim())) return null;
    return Number(raw);
  };
  const numericFields = ["cost", "local_price", "staff_price", "retail_price", "available_stock", "safety_stock"] as const;
  if (numericFields.some((field) => number(field) === null)) {
    return { error: "價格與庫存請填寫零或正數；當地價格最多可填兩位小數，且不要加上幣別或逗號。" };
  }

  return {
    product: {
      sku: values.get("sku")?.trim() ?? "",
      name: values.get("name")!.trim(),
      country: values.get("country")!.trim(),
      category: values.get("category")!.trim(),
      subcategory: values.get("subcategory")?.trim() ?? "",
      specification: values.get("specification")?.trim() ?? "",
      note: values.get("note")?.trim() ?? "",
      cost: number("cost")!,
      local_price: number("local_price")!,
      staff_price: number("staff_price")!,
      retail_price: number("retail_price")!,
      available_stock: number("available_stock")!,
      safety_stock: number("safety_stock")!,
    },
  };
}

function campaignCodeFromProductText(text: string) {
  const match = text.replace(/\r/g, "").match(/^\s*檔期編號\s*[：:]\s*(.*?)\s*$/m);
  return match?.[1]?.trim().toUpperCase() ?? "";
}

async function reply(replyToken: string | undefined, text: string) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!replyToken || !accessToken) {
    console.error("LINE reply unavailable", { hasReplyToken: Boolean(replyToken), hasAccessToken: Boolean(accessToken) });
    return;
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messages: [{ type: "text", text }], replyToken }),
      cache: "no-store",
    });
    if (!response.ok) console.error("LINE reply failed", { status: response.status, statusText: response.statusText });
  } catch (error) {
    console.error("LINE reply request failed", error);
  }
}

async function handleProductTextEvent(event: LineEvent) {
  const text = event.message?.text?.trim() ?? "";
  if (!text) return;

  const allowed = allowedUserIds();
  const userId = event.source?.userId ?? "";
  if (!allowed.size) {
    // 官方帳號仍可正常與客戶聊天；尚未設定管理者前，只在管理者主動
    // 查詢時回覆 ID，絕不對每位客戶自動訊息。
    if (isAuthorizationIdRequest(text)) {
      await reply(event.replyToken, `你的商品上傳授權 ID：\n${userId || "（此訊息沒有可用的使用者 ID）"}\n\n請交給系統管理員設定。`);
    }
    return;
  }
  if (!allowed.has(userId)) {
    if (isAuthorizationIdRequest(text)) {
      await reply(event.replyToken, `你的商品上傳授權 ID：\n${userId || "（此訊息沒有可用的使用者 ID）"}\n\n此帳號尚未取得商品建立權限。`);
    }
    return;
  }

  if (["商品範本", "新增商品範本", "商品格式"].includes(text)) {
    await reply(event.replyToken, template);
    return;
  }
  if (!text.startsWith("新增商品") && !text.startsWith("上傳檔期商品")) return;

  const parsed = parseProduct(text);
  if (!parsed.product) {
    await reply(event.replyToken, parsed.error ?? template);
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: campaigns, error: campaignError } = await supabase
      .from("live_sale_campaigns")
      .select("id, name, campaign_code")
      .eq("status", "進行中")
      .order("start_date", { ascending: false });
    if (campaignError) throw campaignError;
    const campaignCode = campaignCodeFromProductText(text);
    const selectedCampaign = campaignCode
      ? (campaigns ?? []).find((campaign) => campaign.campaign_code === campaignCode)
      : (campaigns ?? []).length === 1 ? campaigns?.[0] : null;
    if (!selectedCampaign) {
      const notice = !(campaigns ?? []).length
        ? "目前沒有進行中的連線檔期，無法暫存商品。請先在後台建立或開啟檔期。"
        : campaignCode
          ? `找不到進行中的檔期編號「${campaignCode}」，請確認後再傳送。`
          : "目前有多個進行中的連線檔期，請在內容第一行加上「檔期編號：KRxxxx」後再傳送。";
      await reply(event.replyToken, notice);
      return;
    }
    const { data: existing, error: existingError } = await supabase
      .from("live_sale_products")
      .select("id")
      .eq("campaign_id", selectedCampaign.id)
      .eq("name", parsed.product.name)
      .eq("specification", parsed.product.specification)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      await reply(event.replyToken, `「${parsed.product.name}${parsed.product.specification ? `／${parsed.product.specification}` : ""}」已在「${selectedCampaign.name}」檔期商品庫，未重複新增。`);
      return;
    }
    const { data: product, error } = await supabase
      .from("live_sale_products")
      .insert({
        campaign_id: selectedCampaign.id,
        name: parsed.product.name,
        country: parsed.product.country,
        category: parsed.product.category,
        subcategory: parsed.product.subcategory,
        specification: parsed.product.specification,
        local_price: parsed.product.local_price,
        cost: parsed.product.cost,
        retail_price: parsed.product.retail_price,
        note: parsed.product.note,
        created_by: `LINE ${userId}`,
      })
      .select("id, name, country, category, subcategory, specification")
      .single();
    if (error) throw error;
    await reply(event.replyToken, `已加入「${selectedCampaign.name}」檔期商品庫：${product.name}${product.specification ? `／${product.specification}` : ""}\n分類：${[product.country, product.category, product.subcategory].filter(Boolean).join(" · ")}\n\n客人確認喊單後，系統才會建立正式商品與貨號。`);
  } catch (error) {
    console.error("LINE live-sale product create failed", error);
    await reply(event.replyToken, "檔期暫存商品未建立成功，請稍後再試；若持續發生，請聯絡系統管理員。" );
  }
}

type CatalogProduct = { id: string; name: string; category: string; specification: string; retail_price: number; cost: number };
type LiveSaleCatalogProduct = { id: string; name: string; category: string; specification: string; retail_price: number; cost: number };
type ParsedClaimItem = {
  raw: string;
  product_id: string | null;
  live_sale_product_id: string | null;
  product_name: string;
  specification: string;
  unit_price: number;
  unit_cost: number;
  quantity: number;
  match_status: "matched" | "unmatched" | "ambiguous";
};

function parseClaimCandidates(message: string) {
  return message
    .replace(/\r/g, "")
    .split(/\n|[，,；;]/)
    .map((line) => line.trim())
    .flatMap((line) => {
      const match = line.match(/^(.+?)(?:\s*[＋+]\s*|\s*[xX×]\s*)(\d{1,3})\s*$/);
      if (!match) return [];
      const label = match[1].trim();
      const quantity = Number(match[2]);
      return label && quantity > 0 ? [{ raw: line, label, quantity }] : [];
    });
}

function hasLiveSaleOrderIntent(message: string, candidates: ReturnType<typeof parseClaimCandidates>) {
  if (candidates.length) return true;
  const normalizedMessage = message.replaceAll(/\s/g, "");
  return /(?:加(?:一|二|三|四|五|六|七|八|九|十|\d+)|(?:我)?(?:想)?要(?:這個|這款|這顆|這組|一個|一份|一組|\d+(?:個|份|組))|幫我(?:留|訂|下單)|我要(?:下單|購買|收|帶走)|(?:收|帶走)(?:這個|這款))/.test(normalizedMessage);
}

function matchingProducts<T extends { id: string; name: string; specification: string }>(label: string, products: T[]) {
  const normalizedLabel = normalizeProductLabel(label);
  return products.filter((product) => {
    const productName = normalizeProductLabel(product.name);
    const productWithSpecification = normalizeProductLabel(`${product.name}${product.specification || ""}`);
    return normalizedLabel === productName || normalizedLabel === productWithSpecification;
  });
}

function matchClaimProduct(label: string, products: CatalogProduct[], liveProducts: LiveSaleCatalogProduct[]) {
  const formalMatches = [...new Map(matchingProducts(label, products).map((product) => [product.id, product])).values()];
  if (formalMatches.length === 1) return { product: formalMatches[0], liveProduct: null, ambiguous: false };
  if (formalMatches.length > 1) return { product: null, liveProduct: null, ambiguous: true };
  const liveMatches = [...new Map(matchingProducts(label, liveProducts).map((product) => [product.id, product])).values()];
  if (liveMatches.length === 1) return { product: null, liveProduct: liveMatches[0], ambiguous: false };
  return { product: null, liveProduct: null, ambiguous: liveMatches.length > 1 };
}

function mergeLineNames(current: string, incoming: string) {
  const cleanCurrent = current.trim();
  const cleanIncoming = incoming.trim();
  if (!cleanIncoming || cleanCurrent.includes(cleanIncoming)) return cleanCurrent;
  return cleanCurrent ? `${cleanCurrent} ／ ${cleanIncoming}`.slice(0, 160) : cleanIncoming.slice(0, 160);
}

async function fetchLineDisplayName(userId: string) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!userId || !accessToken) return "";
  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return "";
    const profile = await response.json() as { displayName?: unknown };
    return typeof profile.displayName === "string" ? profile.displayName.trim().slice(0, 160) : "";
  } catch (error) {
    console.error("LINE profile lookup failed", error);
    return "";
  }
}

async function handleLiveSaleDirectMessage(event: LineEvent) {
  const messageId = event.message?.id ?? "";
  const userId = event.source?.userId ?? "";
  const messageText = event.message?.text?.trim() ?? "";
  if (!messageId || !userId || !messageText || event.source?.type !== "user") return;
  const candidates = parseClaimCandidates(messageText);
  // 僅接收明確喊單字眼，避免客服問答與一般聊天塞入待確認區。
  if (!hasLiveSaleOrderIntent(messageText, candidates)) return;

  const supabase = getSupabaseAdmin();
  const { data: existing, error: lookupError } = await supabase
    .from("live_sale_inbox")
    .select("id")
    .eq("line_message_id", messageId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return;

  const [{ data: products, error: productError }, { data: activeCampaigns, error: campaignError }, { data: aliases, error: aliasError }, lineDisplayName] = await Promise.all([
    supabase.from("products").select("id, name, category, specification, retail_price, cost"),
    supabase.from("live_sale_campaigns").select("id, campaign_code").eq("status", "進行中"),
    supabase.from("live_sale_customer_aliases").select("customer_id, customers(id, name, line_name)").eq("community_name", "LINE 私訊").eq("line_user_id", userId),
    fetchLineDisplayName(userId),
  ]);
  if (productError) throw productError;
  if (campaignError) throw campaignError;
  if (aliasError) throw aliasError;

  // 連線檔期進行中時，保留明確喊單的私訊供人員確認。不是所有客人都會
  // 嚴格使用「商品名稱＋數量」格式；有下單語意但無法自動解析的訊息會
  // 以空的商品明細進入待確認，其他聊天訊息則不會寫入。
  if (!(activeCampaigns ?? []).length) return;

  const campaignMatches = (activeCampaigns ?? []).filter((campaign) => campaign.campaign_code && normalizeProductLabel(messageText).includes(normalizeProductLabel(String(campaign.campaign_code))));
  const campaign = campaignMatches.length === 1 ? campaignMatches[0] : campaignMatches.length === 0 && (activeCampaigns ?? []).length === 1 ? activeCampaigns![0] : null;
  const { data: liveProducts, error: liveProductError } = campaign
    ? await supabase
      .from("live_sale_products")
      .select("id, name, category, specification, retail_price, cost")
      .eq("campaign_id", campaign.id)
      .is("promoted_product_id", null)
    : { data: [], error: null };
  if (liveProductError) throw liveProductError;

  const parsedItems: ParsedClaimItem[] = candidates.map((candidate) => {
    const match = matchClaimProduct(candidate.label, (products ?? []) as CatalogProduct[], (liveProducts ?? []) as LiveSaleCatalogProduct[]);
    if (match.product) {
      const product = match.product;
      return { raw: candidate.raw, product_id: product.id, live_sale_product_id: null, product_name: product.name, specification: product.specification || "", unit_price: Number(product.retail_price) || 0, unit_cost: Number(product.cost) || 0, quantity: candidate.quantity, match_status: "matched" };
    }
    if (match.liveProduct) {
      const product = match.liveProduct;
      return { raw: candidate.raw, product_id: null, live_sale_product_id: product.id, product_name: product.name, specification: product.specification || "", unit_price: Number(product.retail_price) || 0, unit_cost: Number(product.cost) || 0, quantity: candidate.quantity, match_status: "matched" };
    }
    return { raw: candidate.raw, product_id: null, live_sale_product_id: null, product_name: candidate.label, specification: "", unit_price: 0, unit_cost: 0, quantity: candidate.quantity, match_status: match.ambiguous ? "ambiguous" : "unmatched" };
  });

  const aliasCustomers = new Map<string, { id: string; name: string; line_name: string }>();
  for (const alias of aliases ?? []) {
    const customer = alias.customers as unknown as { id: string; name: string; line_name: string } | null;
    if (customer) aliasCustomers.set(customer.id, customer);
  }
  let customer = aliasCustomers.size === 1 ? [...aliasCustomers.values()][0] : null;
  if (customer && lineDisplayName) {
    const lineName = mergeLineNames(customer.line_name, lineDisplayName);
    if (lineName !== customer.line_name) {
      const { error: customerUpdateError } = await supabase
        .from("customers")
        .update({ line_name: lineName, updated_at: new Date().toISOString() })
        .eq("id", customer.id);
      if (customerUpdateError) throw customerUpdateError;
      customer = { ...customer, line_name: lineName };
    }
  }
  const { data: inbox, error: inboxError } = await supabase
    .from("live_sale_inbox")
    .insert({
      line_message_id: messageId,
      line_user_id: userId,
      line_display_name: lineDisplayName,
      screenshot_path: null,
      content_type: "text/plain",
      source_type: "text",
      message_text: messageText,
      campaign_id: campaign?.id ?? null,
      parsed_items: parsedItems,
      customer_id: customer?.id ?? null,
    })
    .select("id")
    .single();
  if (inboxError) {
    if (inboxError.code === "23505") return;
    throw inboxError;
  }

  // LINE 私訊一律先留在待確認區。人員確認客戶、商品與檔期後，
  // 既有的建立喊單流程才會依同檔期／同客戶合併到未結單，避免誤併。
  void inbox;
}

async function handleTextEvent(event: LineEvent) {
  if (event.source?.type === "user") await handleLiveSaleDirectMessage(event);
  await handleProductTextEvent(event);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-line-signature"))) {
    return NextResponse.json({ message: "Invalid LINE signature." }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as LineWebhookBody;
    await Promise.all((payload.events ?? [])
      .filter((event) => event.type === "message")
      .map((event) => {
        if (event.message?.type === "text") return handleTextEvent(event);
        return Promise.resolve();
      }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("LINE webhook failed", error);
    return NextResponse.json({ message: "Unable to process LINE webhook." }, { status: 500 });
  }
}
