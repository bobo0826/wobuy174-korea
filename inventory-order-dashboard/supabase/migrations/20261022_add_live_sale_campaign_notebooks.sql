-- 一個連線檔期可對應多個 LINE 社群記事本。
-- 系統只保存連結與內部備註，不讀取或同步記事本內容。

create table if not exists public.live_sale_campaign_notebooks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.live_sale_campaigns(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  url text not null check (char_length(trim(url)) between 1 and 2048),
  note text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, url)
);

create index if not exists live_sale_campaign_notebooks_campaign_idx
  on public.live_sale_campaign_notebooks(campaign_id, created_at);

alter table public.live_sale_campaign_notebooks enable row level security;

notify pgrst, 'reload schema';
