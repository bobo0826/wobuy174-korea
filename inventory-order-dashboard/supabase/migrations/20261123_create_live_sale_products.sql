-- 連線商品先只存在於檔期中，不會進入正式 products。
-- 第一次被加入喊單時，應用程式才會建立對應的正式商品並留下關聯。
create table if not exists public.live_sale_products (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.live_sale_campaigns(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  country text not null check (char_length(trim(country)) between 1 and 30),
  category text not null default '',
  subcategory text not null default '',
  specification text not null default '',
  local_price integer not null default 0 check (local_price >= 0),
  cost integer not null default 0 check (cost >= 0),
  retail_price integer not null default 0 check (retail_price >= 0),
  note text not null default '',
  promoted_product_id uuid references public.products(id) on delete set null,
  promoted_at timestamptz,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, name, specification)
);

alter table public.live_sale_claim_items
  add column if not exists live_sale_product_id uuid references public.live_sale_products(id) on delete set null;

create index if not exists live_sale_products_campaign_idx
  on public.live_sale_products(campaign_id, created_at desc);

create index if not exists live_sale_products_promoted_idx
  on public.live_sale_products(campaign_id, promoted_product_id);
create unique index if not exists live_sale_products_promoted_product_unique
  on public.live_sale_products(promoted_product_id)
  where promoted_product_id is not null;

create index if not exists live_sale_claim_items_live_product_idx
  on public.live_sale_claim_items(live_sale_product_id);

alter table public.live_sale_products enable row level security;

notify pgrst, 'reload schema';
