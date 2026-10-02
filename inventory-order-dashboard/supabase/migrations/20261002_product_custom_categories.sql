-- 可由使用者擴充的商品第二層分類，依國家區分。
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  name text not null,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  unique (country, name)
);

alter table public.product_categories enable row level security;

create index if not exists product_categories_country_idx
  on public.product_categories(country, created_at);

notify pgrst, 'reload schema';
