create extension if not exists pgcrypto;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  country text not null,
  category text not null,
  specification text not null default '',
  cost integer not null default 0 check (cost >= 0),
  staff_price integer not null default 0 check (staff_price >= 0),
  retail_price integer not null default 0 check (retail_price >= 0),
  available_stock integer not null default 0 check (available_stock >= 0),
  reserved_stock integer not null default 0 check (reserved_stock >= 0),
  incoming_stock integer not null default 0 check (incoming_stock >= 0),
  safety_stock integer not null default 0 check (safety_stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  line_name text not null default '',
  phone text not null default '',
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null default '',
  transaction_method text not null default '',
  moq text not null default '',
  payment_method text not null default '轉帳' check (payment_method in ('現金', '轉帳', '信用卡')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references customers(id) on delete set null,
  order_date date not null default current_date,
  status text not null default '待確認' check (status in ('待確認', '已確認', '已出貨', '已取消')),
  order_method text not null check (order_method in ('社群下單', '員工下單')),
  payment_method text not null default '銀行轉帳',
  reconciliation_status text not null default '待查帳',
  delivery_method text not null default '門市自取',
  delivery_fee integer not null default 0 check (delivery_fee >= 0),
  note text not null default '',
  subtotal integer not null default 0 check (subtotal >= 0),
  total integer not null default 0 check (total >= 0),
  net_profit integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  category text not null default '',
  unit_price integer not null check (unit_price >= 0),
  unit_cost integer not null default 0 check (unit_cost >= 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  quantity_change integer not null check (quantity_change <> 0),
  reason text not null,
  note text not null default '',
  performed_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  purchase_number text not null unique,
  supplier_id uuid references suppliers(id) on delete set null,
  supplier_name text not null,
  expected_arrival_date date,
  payment_terms text not null default '',
  status text not null default '草稿' check (status in ('草稿', '已送出', '部分收貨', '待收貨', '已完成', '已取消')),
  total integer not null default 0 check (total >= 0),
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  unit_cost integer not null check (unit_cost >= 0),
  quantity integer not null check (quantity > 0),
  received_quantity integer not null default 0 check (received_quantity >= 0 and received_quantity <= quantity),
  created_at timestamptz not null default now()
);

create index if not exists products_country_category_idx on products(country, category);
create index if not exists products_supplier_id_idx on products(supplier_id);
create index if not exists suppliers_name_idx on suppliers(name);
create index if not exists orders_customer_id_idx on orders(customer_id);
create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists inventory_adjustments_product_id_idx on inventory_adjustments(product_id);
create index if not exists purchase_order_items_purchase_order_id_idx on purchase_order_items(purchase_order_id);
create index if not exists purchase_orders_supplier_id_idx on purchase_orders(supplier_id);

-- All stock changes are applied inside the database so stock cannot become negative.
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

-- A receipt can be posted more than once. Each line is capped at its remaining quantity.
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

-- Login and role management
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Add a profile for any account that existed before this SQL was run.
insert into public.user_profiles (id, email, display_name)
select id, coalesce(email, ''), coalesce(raw_user_meta_data ->> 'display_name', split_part(coalesce(email, ''), '@', 1))
from auth.users
on conflict (id) do nothing;

alter table public.user_profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.user_profiles;
create policy "Users can read their own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create index if not exists user_profiles_role_idx on public.user_profiles(role);
