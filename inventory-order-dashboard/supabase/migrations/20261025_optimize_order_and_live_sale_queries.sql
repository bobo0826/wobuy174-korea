-- Keep list, report, and live-sale lookups responsive as order history grows.
create index if not exists orders_order_date_created_at_idx
  on public.orders(order_date desc, created_at desc);

create index if not exists order_items_order_id_idx
  on public.order_items(order_id);

create index if not exists live_sale_claims_open_customer_idx
  on public.live_sale_claims(campaign_id, customer_id, created_at asc)
  where status in ('待核對', '待結帳');

create index if not exists live_sale_claims_converted_order_idx
  on public.live_sale_claims(converted_order_id)
  where converted_order_id is not null;
