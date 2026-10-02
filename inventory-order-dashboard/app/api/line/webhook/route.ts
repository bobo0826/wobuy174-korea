import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { syncProductToGoogleSheet } from "@/lib/google-sheets-sync";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type?: string; text?: string };
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
  staff_price: ["員工價"],
  retail_price: ["一般售價", "零售價", "售價"],
  available_stock: ["可售庫存", "初始庫存", "庫存"],
  safety_stock: ["安全庫存"],
};

const template = `請用以下格式傳送：
新增商品
商品編號：KR-001
商品名稱：範例商品
國家：韓國
商品分類：棉被
商品子分類：涼感被
商品規格：雙人
最新成本：850
員工價：1000
一般售價：1280
可售庫存：0
安全庫存：0
備註：`;

const normalize = (value: string) => value.trim().toLowerCase().replaceAll(/\s/g, "");

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

  const required = ["sku", "name", "country", "category"] as const;
  const missing = required.filter((field) => !values.get(field)?.trim());
  if (missing.length) {
    const labels: Record<(typeof required)[number], string> = { sku: "商品編號", name: "商品名稱", country: "國家", category: "商品分類" };
    return { error: `缺少：${missing.map((field) => labels[field]).join("、")}。\n\n${template}` };
  }

  const number = (field: keyof ProductDraft) => {
    const raw = values.get(field) ?? "0";
    if (!/^\d+$/.test(raw.trim())) return null;
    return Number(raw);
  };
  const numericFields = ["cost", "staff_price", "retail_price", "available_stock", "safety_stock"] as const;
  if (numericFields.some((field) => number(field) === null)) {
    return { error: "價格與庫存請填寫零或正整數，不要加上 NT$、逗號或小數點。" };
  }

  return {
    product: {
      sku: values.get("sku")!.trim(),
      name: values.get("name")!.trim(),
      country: values.get("country")!.trim(),
      category: values.get("category")!.trim(),
      subcategory: values.get("subcategory")?.trim() ?? "",
      specification: values.get("specification")?.trim() ?? "",
      note: values.get("note")?.trim() ?? "",
      cost: number("cost")!,
      staff_price: number("staff_price")!,
      retail_price: number("retail_price")!,
      available_stock: number("available_stock")!,
      safety_stock: number("safety_stock")!,
    },
  };
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

async function handleTextEvent(event: LineEvent) {
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
  if (!text.startsWith("新增商品")) return;

  const parsed = parseProduct(text);
  if (!parsed.product) {
    await reply(event.replyToken, parsed.error ?? template);
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: product, error } = await supabase
      .from("products")
      .insert(parsed.product)
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        await reply(event.replyToken, `商品編號「${parsed.product.sku}」已存在，請確認後再傳送。`);
        return;
      }
      throw error;
    }
    const sync = await syncProductToGoogleSheet(product);
    const syncNotice = sync.status === "failed" ? "\n（商品已建立；Google 試算表同步暫時失敗。）" : "";
    await reply(event.replyToken, `已建立商品：${product.name}\n貨號：${product.sku}\n分類：${[product.country, product.category, product.subcategory].filter(Boolean).join(" · ")}${syncNotice}`);
  } catch (error) {
    console.error("LINE product create failed", error);
    await reply(event.replyToken, "商品未建立成功，請稍後再試；若持續發生，請聯絡系統管理員。" );
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-line-signature"))) {
    return NextResponse.json({ message: "Invalid LINE signature." }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as LineWebhookBody;
    await Promise.all((payload.events ?? [])
      .filter((event) => event.type === "message" && event.message?.type === "text")
      .map((event) => handleTextEvent(event)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("LINE webhook failed", error);
    return NextResponse.json({ message: "Unable to process LINE webhook." }, { status: 500 });
  }
}
