-- 修復既有資料庫缺少供應商關聯欄位的情況。
-- 採購單建立、供應商串聯與採購單修改都需要此欄位。
alter table public.purchase_orders
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create index if not exists purchase_orders_supplier_id_idx
  on public.purchase_orders(supplier_id);

-- 讓 Supabase REST API 立即讀取最新欄位定義。
notify pgrst, 'reload schema';
