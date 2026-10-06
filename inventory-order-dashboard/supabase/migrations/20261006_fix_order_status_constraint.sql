-- 正式資料庫曾保留早期的「已到貨」狀態限制；目前訂單流程使用「未出貨」。
-- 先轉換舊資料，再以現行狀態重新建立限制，讓建立與修改訂單的狀態一致。
update public.orders
set status = '未出貨'
where status = '已到貨';

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('預購中', '未出貨', '已出貨', '已取消'));

alter table public.orders
  alter column status set default '預購中';

notify pgrst, 'reload schema';
