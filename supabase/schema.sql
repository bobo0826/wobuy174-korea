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
  bedding_type text,
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

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

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
