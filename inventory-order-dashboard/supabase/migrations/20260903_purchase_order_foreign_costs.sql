-- 保留海外採購的當地幣別、每件當地貨幣成本與整張採購單運費。
-- 既有採購單保留原有台幣成本，新增欄位預設為 0。

alter table public.purchase_orders
  add column if not exists currency_code text not null default 'TWD',
  add column if not exists shipping_fee numeric(14,2) not null default 0;

alter table public.purchase_order_items
  add column if not exists local_unit_cost numeric(14,2) not null default 0;

notify pgrst, 'reload schema';
