alter table public.live_sale_campaigns
  add column if not exists source_spreadsheet_url text not null default '';

-- 使用者指定的 2026/12 韓國連線來源試算表。
update public.live_sale_campaigns
set source_spreadsheet_url = 'https://docs.google.com/spreadsheets/d/1FWdbDcgwYfHSqyJmQX0fIKnaLOLbRoXVN8u2JnATjK4/edit?usp=sharing'
where campaign_code = 'KR202612'
  and source_spreadsheet_url = '';

notify pgrst, 'reload schema';
