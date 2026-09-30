-- 韓國正版 IP 的預設第三層分類改名；保留其他國家（例如日本）的既有資料。
update public.products
set subcategory = '米飛兔', updated_at = now()
where country = '韓國'
  and category = '正版IP'
  and subcategory = '米菲';

update public.products
set subcategory = 'PINGU', updated_at = now()
where country = '韓國'
  and category = '正版IP'
  and lower(subcategory) = 'pingu';

create table if not exists public.product_subcategories (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  category text not null,
  name text not null,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  unique (country, category, name)
);

alter table public.product_subcategories enable row level security;

create index if not exists product_subcategories_parent_idx
  on public.product_subcategories(country, category, created_at);

notify pgrst, 'reload schema';
