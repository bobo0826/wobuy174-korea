-- 修復既有資料庫尚未套用的採購與收貨欄位。
-- 這些欄位支援採購單建立、供應商串聯、到貨入庫與庫存異動紀錄。
alter table public.purchase_orders
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

alter table public.purchase_orders
  add column if not exists received_at timestamptz;

alter table public.purchase_order_items
  add column if not exists received_quantity integer not null default 0;

alter table public.inventory_adjustments
  add column if not exists performed_by text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_order_items_received_quantity_check'
      and conrelid = 'public.purchase_order_items'::regclass
  ) then
    alter table public.purchase_order_items
      add constraint purchase_order_items_received_quantity_check
      check (received_quantity >= 0 and received_quantity <= quantity);
  end if;
end;
$$;

create index if not exists purchase_orders_supplier_id_idx
  on public.purchase_orders(supplier_id);

-- 手動調整與採購收貨皆由資料庫交易處理，避免庫存與紀錄不一致。
create or replace function public.apply_inventory_adjustment(
  p_product_id uuid,
  p_quantity_change integer,
  p_reason text,
  p_note text default '',
  p_performed_by text default ''
)
returns table (product_id uuid, new_available_stock integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_available_stock integer;
begin
  if p_quantity_change = 0 then
    raise exception '異動數量不可為 0';
  end if;

  select available_stock into v_available_stock
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception '找不到商品';
  end if;

  if v_available_stock + p_quantity_change < 0 then
    raise exception '扣除數量不可超過目前可售庫存';
  end if;

  update public.products
  set available_stock = v_available_stock + p_quantity_change,
      updated_at = now()
  where id = p_product_id;

  insert into public.inventory_adjustments (product_id, quantity_change, reason, note, performed_by)
  values (p_product_id, p_quantity_change, trim(p_reason), coalesce(trim(p_note), ''), coalesce(trim(p_performed_by), ''));

  return query
  select id, available_stock
  from public.products
  where id = p_product_id;
end;
$$;

create or replace function public.receive_purchase_order(
  p_purchase_order_id uuid,
  p_items jsonb,
  p_performed_by text default ''
)
returns table (purchase_id uuid, new_status text, last_received_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_line public.purchase_order_items%rowtype;
  v_item record;
  v_all_received boolean;
  v_processed_count integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '請至少填寫一項收貨數量';
  end if;

  select * into v_order
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;

  if not found then
    raise exception '找不到採購單';
  end if;

  if v_order.status in ('已完成', '已取消') then
    raise exception '這張採購單目前無法收貨';
  end if;

  for v_item in
    select item_id, quantity
    from jsonb_to_recordset(p_items) as rows(item_id uuid, quantity integer)
  loop
    if v_item.item_id is null or v_item.quantity is null or v_item.quantity <= 0 then
      raise exception '收貨數量必須為正整數';
    end if;

    select * into v_line
    from public.purchase_order_items
    where id = v_item.item_id
      and purchase_order_id = p_purchase_order_id
    for update;

    if not found then
      raise exception '採購明細不屬於這張採購單';
    end if;

    if v_item.quantity > v_line.quantity - v_line.received_quantity then
      raise exception '% 的收貨數量超過未收貨數量', v_line.product_name;
    end if;

    if v_line.product_id is null then
      raise exception '% 未連結商品，無法入庫', v_line.product_name;
    end if;

    update public.purchase_order_items
    set received_quantity = received_quantity + v_item.quantity
    where id = v_line.id;

    update public.products
    set available_stock = available_stock + v_item.quantity,
        incoming_stock = greatest(0, incoming_stock - v_item.quantity),
        updated_at = now()
    where id = v_line.product_id;

    insert into public.inventory_adjustments (product_id, quantity_change, reason, note, performed_by)
    values (v_line.product_id, v_item.quantity, '採購收貨', '採購單 ' || v_order.purchase_number, coalesce(trim(p_performed_by), ''));

    v_processed_count := v_processed_count + 1;
  end loop;

  if v_processed_count = 0 then
    raise exception '請至少填寫一項收貨數量';
  end if;

  select bool_and(received_quantity >= quantity) into v_all_received
  from public.purchase_order_items
  where purchase_order_id = p_purchase_order_id;

  update public.purchase_orders
  set status = case when coalesce(v_all_received, false) then '已完成' else '部分收貨' end,
      received_at = now(),
      updated_at = now()
  where id = p_purchase_order_id;

  return query
  select id, status, received_at
  from public.purchase_orders
  where id = p_purchase_order_id;
end;
$$;

-- 讓 Supabase REST API 立即讀取最新欄位定義。
notify pgrst, 'reload schema';
