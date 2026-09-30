-- 將多筆信用卡代墊款以一個帳單總額一起請款結清。
create table if not exists public.credit_card_claim_batches (
  id uuid primary key default gen_random_uuid(),
  total_twd_amount integer not null check (total_twd_amount > 0),
  entry_count integer not null check (entry_count > 0),
  claimed_by text not null default '',
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.credit_card_claim_batches enable row level security;

alter table public.financial_transactions
  add column if not exists credit_card_claim_batch_id uuid references public.credit_card_claim_batches(id) on delete restrict;

create index if not exists financial_transactions_credit_card_claim_batch_idx
  on public.financial_transactions(credit_card_claim_batch_id)
  where credit_card_claim_batch_id is not null;

notify pgrst, 'reload schema';
