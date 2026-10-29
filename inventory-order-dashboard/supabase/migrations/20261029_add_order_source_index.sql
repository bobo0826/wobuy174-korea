-- Keep normal orders and converted live-sale orders separate at the database
-- layer, so everyday list and dashboard queries never need to scan claims.
alter table public.orders
  add column if not exists order_source text not null default 'general';

alter table public.orders
  drop constraint if exists orders_order_source_check;

alter table public.orders
  add constraint orders_order_source_check
  check (order_source in ('general', 'live_sale'));

-- Backfill previously converted live-sale claims before the application starts
-- filtering by order_source.
update public.orders as orders
set order_source = 'live_sale'
from public.live_sale_claims as claims
where claims.converted_order_id = orders.id
  and orders.order_source <> 'live_sale';

-- This matches the normal-order list's source filter and sort order.
create index if not exists orders_source_date_created_at_idx
  on public.orders(order_source, order_date desc, created_at desc);

notify pgrst, 'reload schema';
