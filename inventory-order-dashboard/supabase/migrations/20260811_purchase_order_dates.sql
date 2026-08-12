-- 採購單的下單時間與到貨時間分開儲存。
-- 保留既有 expected_arrival_date 欄位，確保舊資料與既有程式不會中斷。
alter table public.purchase_orders
  add column if not exists order_date date,
  add column if not exists arrival_date date;

update public.purchase_orders
set order_date = coalesce(order_date, created_at::date, current_date),
    arrival_date = coalesce(arrival_date, expected_arrival_date)
where order_date is null or arrival_date is null;

alter table public.purchase_orders
  alter column order_date set default current_date;

alter table public.purchase_orders
  alter column order_date set not null;
