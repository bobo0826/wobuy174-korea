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
  created_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  purchase_number text not null unique,
  supplier_name text not null,
  expected_arrival_date date,
  payment_terms text not null default '',
  status text not null default '草稿' check (status in ('草稿', '已送出', '部分收貨', '待收貨', '已完成', '已取消')),
  total integer not null default 0 check (total >= 0),
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
  created_at timestamptz not null default now()
);

create index if not exists products_country_category_idx on products(country, category);
create index if not exists orders_customer_id_idx on orders(customer_id);
create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists inventory_adjustments_product_id_idx on inventory_adjustments(product_id);
create index if not exists purchase_order_items_purchase_order_id_idx on purchase_order_items(purchase_order_id);
