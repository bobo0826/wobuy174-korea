-- Preserve historical screenshot records while supporting text-only LINE private-message claims.
alter table public.live_sale_inbox
  alter column screenshot_path drop not null;

alter table public.live_sale_inbox
  add column if not exists source_type text not null default 'screenshot',
  add column if not exists message_text text not null default '',
  add column if not exists campaign_id uuid references public.live_sale_campaigns(id) on delete set null,
  add column if not exists parsed_items jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'live_sale_inbox_source_type_check'
  ) then
    alter table public.live_sale_inbox
      add constraint live_sale_inbox_source_type_check
      check (source_type in ('screenshot', 'text'));
  end if;
end $$;

create index if not exists live_sale_inbox_text_campaign_idx
  on public.live_sale_inbox(campaign_id, status, received_at desc)
  where source_type = 'text';

notify pgrst, 'reload schema';
