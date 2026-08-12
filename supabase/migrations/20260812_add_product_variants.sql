-- 商品子分類規格與不同價格
-- 已經建立 products 資料表的專案，請在 Supabase SQL Editor 執行此檔案一次。

alter table public.products
add column if not exists variants jsonb not null default '[]'::jsonb;
