alter table public.products
  add column if not exists note text not null default '';
