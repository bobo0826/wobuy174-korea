-- 可管理的商品子分類與日本選品子分類。
-- 請在既有 Supabase 專案的 SQL Editor 執行一次。

create extension if not exists "pgcrypto";

alter table public.products add column if not exists japan_type text;

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

alter table public.product_subcategories enable row level security;

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

grant select on public.product_subcategories to anon, authenticated;
grant insert, update, delete on public.product_subcategories to authenticated;
