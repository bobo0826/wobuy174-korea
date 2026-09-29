-- 將「訂單結帳」收款與原始訂單建立正式關聯，保留刪除訂單後的收支紀錄。
alter table public.financial_transactions
  add column if not exists order_id uuid references public.orders(id) on delete set null;

create index if not exists financial_transactions_order_id_idx
  on public.financial_transactions(order_id);

notify pgrst, 'reload schema';
