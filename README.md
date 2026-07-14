# 信男代購 WOBUY174_

日韓選品商品展示網站，使用 Next.js、Tailwind CSS、Supabase 與 Vercel。

## 商品後台設定

1. 在 [Supabase](https://supabase.com/dashboard) 建立新專案。
2. 到 **SQL Editor** 執行 [supabase/schema.sql](./supabase/schema.sql)。
3. 到 **Authentication > Users** 新增自己的登入帳號。
4. 將 `schema.sql` 最後的 `your-email@example.com` 換成該帳號信箱並執行，授予管理員權限。
5. 從 Supabase 的 **Connect** 面板複製 Project URL 與 Publishable key；依照 [.env.example](./.env.example) 建立 `.env.local`。
6. 在 Vercel 專案的 **Environment Variables** 設定相同兩個變數後重新部署。

完成後前往 `/admin`，以管理員帳號登入。

## 批量上傳

1. 於 `/admin` 下載 `CSV 範本`，填入商品編號、品名、價格與其他欄位。
2. 將照片以商品編號作開頭命名，例如 `KR-400-1.jpg`、`KR-400-2.jpg`。
3. 在後台一次選取 CSV 與所有商品照片，按下「開始批量匯入」。
4. 每頁商品最多顯示 16 件，新增商品會自動出現在第 2 頁以後。

CSV 內的分類可填寫：`熱門商品`、`韓國棉被`、`韓國選品`、`日本選品`、`其他選品`。韓國選品子分類可填寫：`正版玩偶`、`正韓睡衣`、`時尚潮牌`、`零食糖果`、`藥局美妝`、`免稅精選`、`純棉襪子`。

## Google 試算表自動同步

已提供「Google 試算表 → 網站」的單向同步：編輯商品列後，同一個商品編號會自動更新；新商品列會自動建立並發布。商品照片仍請透過 `/admin` 上傳，因為試算表只同步文字、價格、分類和商品狀態。

### 1. 先完成 Supabase 資料表更新

在 Supabase 的 **SQL Editor** 重新執行一次 [supabase/schema.sql](./supabase/schema.sql)，以確保 `原價`、`顏色`、`尺寸` 欄位已存在。

### 2. 在 Vercel 設定安全變數

進入 Vercel 專案的 **Settings > Environment Variables**，新增下列變數並套用至 Production、Preview、Development：

- `SUPABASE_SERVICE_ROLE_KEY`：Supabase **Project Settings > API Keys** 內的 Secret / service_role key。只能放在 Vercel，不能放在前端或 Google 試算表。
- `GOOGLE_SHEETS_SYNC_SECRET`：自行設定一組至少 32 字元的隨機密碼。這個值會同時填入 Apps Script，請不要公開。

新增後重新部署，取得網站網址，例如 `https://你的專案.vercel.app`。

### 3. 安裝 Google Apps Script

1. 開啟 [網站上架表格](https://docs.google.com/spreadsheets/d/1peEtOCcRN1ahIULzTTtOTqwZdUyJYkUv1DZazD1IYBY/edit)。
2. 點擊 **擴充功能 > Apps Script**，刪除預設內容，貼上 [scripts/google-sheets-sync.gs](./scripts/google-sheets-sync.gs) 全部內容。
3. 將檔案最上方的 `WEBHOOK_URL` 改成 `https://你的專案.vercel.app/api/google-sheets-sync`，並將 `SYNC_SECRET` 改成與 Vercel 完全相同的密碼。
4. 儲存後，在函式下拉選單選擇 `installEditTrigger`，按 **執行** 並完成 Google 授權。這會建立可使用網路請求的「安裝型編輯觸發器」。
5. 重新整理試算表，選單會出現 **信男代購同步**；先按一次「同步全部商品」完成初次同步。

試算表目前使用的欄位是：`商品編號`、`品名`、`原價`、`優惠價`、`收單日`、`預計到貨`、`顏色`、`尺寸`、`分類`、`韓國子分類`、`棉被子分類`、`貨況`、`國別`。也可額外新增 `商品介紹`、`規格`、`是否發布`、`排序` 四欄；`是否發布` 填「否」即可不在網站公開，`排序` 數字越小會越前面。若試算表沒有「排序」欄，從後台設定的排序會被保留。

> 同步需要 Google 的「安裝型編輯觸發器」，因為它可在你修改試算表時安全呼叫網站 Webhook；它會以建立觸發器的 Google 帳號身分執行。

## 本機開發

```bash
npm run dev
```

開啟 [http://127.0.0.1:3001](http://127.0.0.1:3001)。
