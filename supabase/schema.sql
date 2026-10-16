-- 信男代購商品資料庫與圖片儲存空間
-- 請在 Supabase Dashboard > SQL Editor 貼上並執行一次。

create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price text not null,
  original_price text,
  status text not null default '預購' check (status in ('現貨', '預購', '連線中', '已收單')),
  country text not null default 'KOREA' check (country in ('KOREA', 'JAPAN', 'SELECT')),
  categories text[] not null default '{}',
  korea_type text,
  plush_type text,
  bedding_type text,
  japan_type text,
  deadline text,
  arrival text,
  colors text,
  sizes text,
  variants jsonb not null default '[]'::jsonb,
  details text,
  specs text,
  image_urls text[] not null default '{}',
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products add column if not exists original_price text;
alter table public.products add column if not exists colors text;
alter table public.products add column if not exists sizes text;
alter table public.products add column if not exists variants jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists sort_order integer not null default 0;
alter table public.products add column if not exists plush_type text;
alter table public.products add column if not exists japan_type text;

-- 可由後台管理的子分類。scope 對應：bedding=韓國棉被、korea=韓國選品、
-- plush=正版玩偶（韓國選品的下一層）、japan=日本選品。
create table if not exists public.product_subcategories (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('bedding', 'korea', 'plush', 'japan')),
  value text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (scope, value)
);

insert into public.product_subcategories (scope, value, label, sort_order)
values
  ('bedding', 'cool', '涼感被', 1),
  ('bedding', 'allSeason', '四季被', 2),
  ('bedding', 'pillow', '秒睡枕', 3),
  ('korea', 'plush', '正版玩偶', 1),
  ('korea', 'pajamas', '正韓睡衣', 2),
  ('korea', 'fashion', '時尚潮牌', 3),
  ('korea', 'snacks', '零食糖果', 4),
  ('korea', 'beauty', '藥局美妝', 5),
  ('korea', 'dutyFree', '免稅精選', 6),
  ('korea', 'socks', '純棉襪子', 7),
  ('plush', 'sanrio', '三麗鷗', 1),
  ('plush', 'chiikawa', '吉伊卡哇', 2),
  ('plush', 'pokemon', '寶可夢', 3),
  ('plush', 'miffy', '米飛兔', 4),
  ('plush', 'pingu', 'PINGU', 5),
  ('plush', 'regional', '地區限定', 6),
  ('plush', 'other', '其他', 7),
  ('japan', 'sanrio', '三麗鷗', 1),
  ('japan', 'chiikawa', '吉伊卡哇', 2),
  ('japan', 'officialIp', '正版IP', 3),
  ('japan', 'fashion', '時尚潮牌', 4),
  ('japan', 'snacks', '零食糖果', 5),
  ('japan', 'beauty', '藥妝美妝', 6),
  ('japan', 'dutyFree', '免稅精選', 7)
on conflict (scope, value) do nothing;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute procedure public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

alter table public.products enable row level security;
alter table public.admin_users enable row level security;
alter table public.product_subcategories enable row level security;

drop policy if exists "public can read published products" on public.products;
create policy "public can read published products"
on public.products
for select
to anon, authenticated
using (published = true or public.is_admin());

drop policy if exists "admins can manage products" on public.products;
create policy "admins can manage products"
on public.products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins can see their access" on public.admin_users;
create policy "admins can see their access"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "public can read product subcategories" on public.product_subcategories;
create policy "public can read product subcategories"
on public.product_subcategories
for select
to anon, authenticated
using (true);

drop policy if exists "admins can manage product subcategories" on public.product_subcategories;
create policy "admins can manage product subcategories"
on public.product_subcategories
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.product_subcategories to anon, authenticated;
grant insert, update, delete on public.product_subcategories to authenticated;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public can view product images" on storage.objects;
create policy "public can view product images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "admins can manage product images" on storage.objects;
create policy "admins can manage product images"
on storage.objects
for all
to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

-- 建立 Supabase Authentication 使用者後，將下方 email 改成你的登入信箱，再執行一次：
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = 'your-email@example.com'
-- on conflict (user_id) do nothing;
