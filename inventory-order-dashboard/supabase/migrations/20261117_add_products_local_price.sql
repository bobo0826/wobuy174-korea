-- 商品資料庫的當地價格：依商品採購地幣別手動保存，不影響台幣成本或售價。
alter table public.products
  add column if not exists local_price numeric(14,2) not null default 0
  check (local_price >= 0);

notify pgrst, 'reload schema';
