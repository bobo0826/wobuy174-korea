-- Upgrade the single announcement into three rotating storefront messages.
-- The first message preserves any existing custom announcement.

create table if not exists public.site_announcement_items (
  slot smallint primary key check (slot between 1 and 3),
  content text not null,
  updated_at timestamptz not null default now()
);

insert into public.site_announcement_items (slot, content)
select 1, coalesce((select content from public.site_announcements where id = true), '新品、連線與現貨資訊，請持續關注！')
on conflict (slot) do nothing;

insert into public.site_announcement_items (slot, content)
values
  (2, '歡迎加入 LINE 社群，掌握最新到貨與連線消息。'),
  (3, '現貨商品可直接私訊 LINE@ 詢問庫存與下單。')
on conflict (slot) do nothing;

drop trigger if exists site_announcement_items_set_updated_at on public.site_announcement_items;
create trigger site_announcement_items_set_updated_at
before update on public.site_announcement_items
for each row execute procedure public.set_updated_at();

alter table public.site_announcement_items enable row level security;

drop policy if exists "public can read site announcement items" on public.site_announcement_items;
create policy "public can read site announcement items"
on public.site_announcement_items
for select
to anon, authenticated
using (true);

drop policy if exists "admins can manage site announcement items" on public.site_announcement_items;
create policy "admins can manage site announcement items"
on public.site_announcement_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.site_announcement_items to anon, authenticated;
grant insert, update, delete on public.site_announcement_items to authenticated;
