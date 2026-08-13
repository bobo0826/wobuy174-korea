-- 將既有「已到貨」訂單改為新的待出貨狀態，並更新資料庫限制。
alter table public.orders drop constraint if exists orders_status_check;

update public.orders
set status = '未出貨'
where status = '已到貨';

alter table public.orders
  add constraint orders_status_check
  check (status in ('預購中', '未出貨', '已出貨', '已取消'));

alter table public.orders alter column status set default '預購中';
