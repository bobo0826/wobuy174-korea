-- 收支管理：客戶收款、供應商貨款與期初現金。
create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('customer_payment', 'supplier_payment', 'opening_cash')),
  direction text not null check (direction in ('income', 'expense')),
  payment_method text not null check (payment_method in ('現金', '轉帳', '匯款', '信用卡')),
  currency text not null default 'TWD' check (currency in ('TWD', 'KRW', 'JPY')),
  amount integer not null check (amount > 0),
  occurred_on date not null default current_date,
  counterparty_name text not null default '',
  customer_id uuid references public.customers(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  note text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  check (
    (entry_type = 'customer_payment' and direction = 'income' and customer_id is not null and supplier_id is null and payment_method in ('現金', '轉帳'))
    or (entry_type = 'supplier_payment' and direction = 'expense' and supplier_id is not null and customer_id is null and payment_method in ('現金', '匯款', '信用卡'))
    or (entry_type = 'opening_cash' and direction = 'income' and customer_id is null and supplier_id is null and payment_method = '現金')
  )
);

-- 若先前已建立此資料表，補上多幣別欄位並以台幣作為舊資料預設值。
alter table public.financial_transactions
  add column if not exists currency text not null default 'TWD';

create index if not exists financial_transactions_occurred_on_idx
  on public.financial_transactions(occurred_on desc, created_at desc);

create index if not exists financial_transactions_customer_id_idx
  on public.financial_transactions(customer_id);

create index if not exists financial_transactions_supplier_id_idx
  on public.financial_transactions(supplier_id);

notify pgrst, 'reload schema';
