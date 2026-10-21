-- 連線／代購檔期與喊單資料，和一般 orders 完全分開保存。
-- 只有在管理者手動轉單時，才會建立既有的 orders / order_items 資料。

create table if not exists public.live_sale_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  campaign_code text not null unique check (campaign_code ~ '^[A-Z0-9-]{2,20}$'),
  status text not null default '進行中' check (status in ('進行中', '已結單', '已封存')),
  start_date date not null default current_date,
  end_date date,
  note text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

-- LINE 官方帳號收到的記事本截圖。圖片儲存於私有 Storage bucket，
-- 前台一律透過已登入的 API 取得短效簽名網址。
create table if not exists public.live_sale_inbox (
  id uuid primary key default gen_random_uuid(),
  line_message_id text not null unique,
  line_user_id text not null default '',
  screenshot_path text not null,
  content_type text not null default 'image/jpeg',
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default '待處理' check (status in ('待處理', '已建立喊單', '已略過')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 同一位客人可以有多個社群記事本名稱；首次由人員確認後，
-- 後續同一 LINE 使用者傳來的截圖即可自動帶入客戶資料。
create table if not exists public.live_sale_customer_aliases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  community_name text not null check (char_length(trim(community_name)) between 1 and 80),
  line_user_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, community_name),
  unique (line_user_id, community_name)
);

create table if not exists public.live_sale_claims (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.live_sale_campaigns(id) on delete restrict,
  claim_number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null default '',
  line_name text not null default '',
  community_name text not null default '',
  source_inbox_id uuid references public.live_sale_inbox(id) on delete set null,
  status text not null default '待核對' check (status in ('待核對', '待結帳', '已結帳', '已轉訂單', '已取消')),
  claim_total integer not null default 0 check (claim_total >= 0),
  note text not null default '',
  payment_marked_at timestamptz,
  payment_marked_by text not null default '',
  converted_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, claim_number),
  unique (source_inbox_id),
  unique (converted_order_id)
);

create table if not exists public.live_sale_claim_items (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.live_sale_claims(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null default '',
  category text not null default '',
  specification text not null default '',
  unit_price integer not null default 0 check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

-- 檔期結單後可填入供應商實際能提供的數量；未填表示尚未確認，
-- 系統不會誤判為缺貨。此數量只用於通知與採購統整，不會調整庫存。
create table if not exists public.live_sale_campaign_products (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.live_sale_campaigns(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  available_quantity integer check (available_quantity is null or available_quantity >= 0),
  note text not null default '',
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, product_id)
);

create index if not exists live_sale_campaigns_status_idx on public.live_sale_campaigns(status, start_date desc, created_at desc);
create index if not exists live_sale_inbox_status_idx on public.live_sale_inbox(status, received_at desc);
create index if not exists live_sale_inbox_line_user_idx on public.live_sale_inbox(line_user_id, received_at desc);
create index if not exists live_sale_aliases_line_user_idx on public.live_sale_customer_aliases(line_user_id);
create index if not exists live_sale_claims_campaign_idx on public.live_sale_claims(campaign_id, created_at desc);
create index if not exists live_sale_claims_status_idx on public.live_sale_claims(campaign_id, status);
create index if not exists live_sale_claim_items_claim_idx on public.live_sale_claim_items(claim_id);
create index if not exists live_sale_claim_items_product_idx on public.live_sale_claim_items(product_id);
create index if not exists live_sale_campaign_products_campaign_idx on public.live_sale_campaign_products(campaign_id, product_id);

alter table public.live_sale_campaigns enable row level security;
alter table public.live_sale_inbox enable row level security;
alter table public.live_sale_customer_aliases enable row level security;
alter table public.live_sale_claims enable row level security;
alter table public.live_sale_claim_items enable row level security;
alter table public.live_sale_campaign_products enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'live-sale-screenshots',
  'live-sale-screenshots',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
