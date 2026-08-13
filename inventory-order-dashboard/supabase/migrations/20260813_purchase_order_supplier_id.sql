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

-- 讓 Supabase REST API 立即讀取最新欄位定義。
notify pgrst, 'reload schema';
