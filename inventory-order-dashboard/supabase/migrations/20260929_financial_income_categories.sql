-- 收支管理支援訂單結帳、零售購買與其他收入；非供應商類支出也可保留自填對象。
alter table public.financial_transactions
  drop constraint if exists financial_transactions_check;

alter table public.financial_transactions
  add constraint financial_transactions_check
  check (
    (entry_type = 'customer_payment' and direction = 'income' and supplier_id is null and payment_method in ('現金', '轉帳'))
    or (entry_type = 'supplier_payment' and direction = 'expense' and customer_id is null and payment_method in ('現金', '匯款', '信用卡'))
    or (entry_type = 'opening_cash' and direction = 'income' and customer_id is null and supplier_id is null and payment_method = '現金')
  );

notify pgrst, 'reload schema';
