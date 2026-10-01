This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## LINE 建立商品

啟用 LINE Messaging API 後，將以下環境變數設定於 Vercel（不可提交至 Git）：

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_ALLOWED_USER_IDS`：允許新增商品的 LINE 使用者 ID；多位使用者以逗號分隔。

Webhook URL 為 `https://wobuy174-stock.vercel.app/api/line/webhook`。LINE Developers Console 必須開啟 Webhook。未設定允許使用者前，先向官方帳號傳送任意訊息，機器人會私訊回覆該帳號的 LINE 使用者 ID；將它填入 `LINE_ALLOWED_USER_IDS` 後即可啟用。

在 LINE 傳送「商品範本」取得格式，或直接傳送：

```text
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
備註：
```
