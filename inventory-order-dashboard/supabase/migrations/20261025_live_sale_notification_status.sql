-- 連線訂單轉成一般訂單後，保留客戶通知進度；真正出貨仍以 orders.status 為準。
alter table public.live_sale_claims
  add column if not exists notification_status text not null default '未通知';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'live_sale_claims_notification_status_check'
      and conrelid = 'public.live_sale_claims'::regclass
  ) then
    alter table public.live_sale_claims
      add constraint live_sale_claims_notification_status_check
      check (notification_status in ('未通知', '已通知'));
  end if;
end $$;

create index if not exists live_sale_claims_campaign_notification_idx
  on public.live_sale_claims(campaign_id, notification_status, created_at desc)
  where converted_order_id is not null;

notify pgrst, 'reload schema';
