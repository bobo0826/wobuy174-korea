-- 客戶類別與常用交易方式，供客戶管理與建立訂單快速帶入使用。
alter table public.customers
  add column if not exists customer_category text not null default '社群',
  add column if not exists preferred_delivery_method text not null default '自取';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_customer_category_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_customer_category_check
      check (customer_category in ('員工', '社群'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_preferred_delivery_method_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_preferred_delivery_method_check
      check (preferred_delivery_method in ('自取', '賣貨便'));
  end if;
end;
$$;

notify pgrst, 'reload schema';
