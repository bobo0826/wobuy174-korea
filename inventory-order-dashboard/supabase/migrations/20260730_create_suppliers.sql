create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null default '',
  transaction_method text not null default '',
  moq text not null default '',
  payment_method text not null default '轉帳' check (payment_method in ('現金', '轉帳', '信用卡')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_name_idx on suppliers(name);
