alter table public.orders drop constraint if exists orders_status_check;

-- Replace the early demo order states with the live workflow.
update public.orders
set status = case
  when status in ('待確認', '已確認', '備貨中') then '預購中'
  when status = '已出貨' then '已出貨'
  else '已取消'
end;

alter table public.orders
  add constraint orders_status_check
  check (status in ('預購中', '已到貨', '已出貨', '已取消'));
alter table public.orders alter column status set default '預購中';

-- A single payment-status field is used for cash, transfer, and card orders.
update public.orders
set reconciliation_status = case
  when reconciliation_status in ('已付款', '已查帳') then '已付款'
  else '未付款'
end;
alter table public.orders alter column reconciliation_status set default '未付款';

-- When a shipped order is deleted, restore stock in the same database transaction.
create or replace function public.delete_order_and_restore_stock(
  p_order_id uuid,
  p_performed_by text default ''
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception '找不到訂單';
  end if;

  if v_order.status = '已出貨' then
    for v_item in
      select product_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = p_order_id and product_id is not null
      group by product_id
    loop
      perform public.apply_inventory_adjustment(
        v_item.product_id,
        v_item.quantity,
        '刪除訂單回補庫存',
        '訂單 ' || v_order.order_number,
        coalesce(trim(p_performed_by), '')
      );
    end loop;
  end if;

  delete from public.orders where id = p_order_id;
end;
$$;
