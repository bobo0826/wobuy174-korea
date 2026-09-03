-- 商品基本資料與價格異動歷程。
create table if not exists public.product_change_logs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  change_note text not null default '',
  changed_by text not null default '',
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_change_logs_product_id_created_at_idx
  on public.product_change_logs(product_id, created_at desc);

notify pgrst, 'reload schema';
