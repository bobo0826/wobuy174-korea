-- Fix the receipt RPC: its result-column name matched the table column name,
-- which made PostgreSQL treat the SELECT as ambiguous at runtime.
create or replace function public.set_live_sale_received_quantity(
  p_campaign_id uuid,
  p_product_id uuid,
  p_received_quantity integer,
  p_performed_by text default ''
)
returns table (received_quantity integer, new_available_stock integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_previous_quantity integer := 0;
  v_delta integer;
  v_available_stock integer;
  v_campaign_code text;
begin
  if p_received_quantity is null or p_received_quantity < 0 then
    raise exception '到貨數量必須為零或正整數';
  end if;

  select campaign_code into v_campaign_code
  from public.live_sale_campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception '找不到連線檔期';
  end if;

  select available_stock into v_available_stock
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception '找不到商品';
  end if;

  select allocation.received_quantity into v_previous_quantity
  from public.live_sale_campaign_products as allocation
  where allocation.campaign_id = p_campaign_id
    and allocation.product_id = p_product_id
  for update;

  v_previous_quantity := coalesce(v_previous_quantity, 0);
  v_delta := p_received_quantity - v_previous_quantity;

  if v_available_stock + v_delta < 0 then
    raise exception '到貨數量不可低於已同步至商品庫存的數量';
  end if;

  insert into public.live_sale_campaign_products (
    campaign_id,
    product_id,
    received_quantity,
    updated_by,
    updated_at
  ) values (
    p_campaign_id,
    p_product_id,
    p_received_quantity,
    coalesce(trim(p_performed_by), ''),
    now()
  )
  on conflict (campaign_id, product_id) do update
  set received_quantity = excluded.received_quantity,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  if v_delta <> 0 then
    update public.products
    set available_stock = v_available_stock + v_delta,
        updated_at = now()
    where id = p_product_id;

    insert into public.inventory_adjustments (
      product_id,
      quantity_change,
      reason,
      note
    ) values (
      p_product_id,
      v_delta,
      '連線採購到貨',
      '連線檔期 ' || v_campaign_code || ' 到貨累計調整'
    );
  end if;

  return query
  select p_received_quantity, v_available_stock + v_delta;
end;
$$;

notify pgrst, 'reload schema';
