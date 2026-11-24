-- 保留 LINE 官方帳號回傳的使用者顯示名稱，供人員確認客戶時帶入 LINE@ 名稱。
alter table public.live_sale_inbox
  add column if not exists line_display_name text not null default '';

create index if not exists live_sale_inbox_line_display_name_idx
  on public.live_sale_inbox(line_display_name)
  where line_display_name <> '';

notify pgrst, 'reload schema';
