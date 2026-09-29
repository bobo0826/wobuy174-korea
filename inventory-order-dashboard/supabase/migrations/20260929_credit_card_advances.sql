-- 信用卡支出視為代墊款；外幣交易可在結帳後補上實際台幣金額，再鎖定為已請款。
alter table public.financial_transactions
  add column if not exists settled_twd_amount integer check (settled_twd_amount is null or settled_twd_amount > 0),
  add column if not exists credit_card_claimed boolean not null default false,
  add column if not exists credit_card_claimed_at timestamptz,
  add column if not exists credit_card_claimed_by text not null default '';

create index if not exists financial_transactions_credit_card_claimed_idx
  on public.financial_transactions(credit_card_claimed)
  where payment_method = '信用卡';

notify pgrst, 'reload schema';
