-- 收支分類與信用卡支出明細。此版本採可重複執行的補欄位方式，適用於既有正式資料庫。
alter table public.financial_transactions
  add column if not exists major_category text,
  add column if not exists sub_category text,
  add column if not exists region text,
  add column if not exists card_detail text;

-- 舊有收支紀錄會保留原資料，並以既有方向與類型補上可讀的分類。
update public.financial_transactions
set major_category = case
  when entry_type = 'opening_cash' then '期初現金'
  when direction = 'income' then '收入'
  else '支出'
end
where major_category is null;

update public.financial_transactions
set sub_category = case
  when entry_type = 'opening_cash' then '期初現金'
  when direction = 'income' then '客人購買'
  else '供應商貨款'
end
where sub_category is null;

notify pgrst, 'reload schema';
