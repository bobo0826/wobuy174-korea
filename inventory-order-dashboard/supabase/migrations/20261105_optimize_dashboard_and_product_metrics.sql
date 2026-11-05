-- Keep dashboard and product-catalog reads compact as order history grows.
-- These functions are called only from authenticated server routes.

create or replace function public.get_dashboard_summary()
returns table (
  preorders bigint,
  low_stock bigint,
  pending_purchases bigint,
  monthly_sales bigint,
  shipped_orders bigint,
  order_count bigint
)
language sql
stable
set search_path = public
as $$
  with order_summary as (
    select
      count(*) filter (where status = '預購中')::bigint as preorders,
      coalesce(sum(total) filter (
        where order_date >= date_trunc('month', timezone('Asia/Taipei', now()))::date
          and order_date < (date_trunc('month', timezone('Asia/Taipei', now())) + interval '1 month')::date
          and status <> '已取消'
      ), 0)::bigint as monthly_sales,
      count(*) filter (where status = '已出貨')::bigint as shipped_orders,
      count(*)::bigint as order_count
    from public.orders
    where order_source = 'general'
  ), product_summary as (
    select count(*) filter (where available_stock <= safety_stock)::bigint as low_stock
    from public.products
  ), purchase_summary as (
    select count(*) filter (where status not in ('已完成', '已取消'))::bigint as pending_purchases
    from public.purchase_orders
  )
  select
    order_summary.preorders,
    product_summary.low_stock,
    purchase_summary.pending_purchases,
    order_summary.monthly_sales,
    order_summary.shipped_orders,
    order_summary.order_count
  from order_summary
  cross join product_summary
  cross join purchase_summary;
$$;

create or replace function public.get_product_catalog_metrics()
returns table (
  product_id uuid,
  preorder_stock bigint,
  sold_stock bigint
)
language sql
stable
set search_path = public
as $$
  select
    items.product_id,
    coalesce(sum(items.quantity) filter (where orders.status = '預購中'), 0)::bigint as preorder_stock,
    coalesce(sum(items.quantity) filter (where orders.status = '已出貨'), 0)::bigint as sold_stock
  from public.order_items as items
  inner join public.orders as orders on orders.id = items.order_id
  where items.product_id is not null
    and orders.status in ('預購中', '已出貨')
  group by items.product_id;
$$;

create index if not exists orders_source_status_order_date_idx
  on public.orders(order_source, status, order_date desc, created_at desc);

create index if not exists orders_source_reconciliation_order_date_idx
  on public.orders(order_source, reconciliation_status, order_date desc, created_at desc);

create index if not exists order_items_product_id_idx
  on public.order_items(product_id);

notify pgrst, 'reload schema';
