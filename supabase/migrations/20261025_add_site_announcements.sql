-- 前台「最新消息」內容，由商品後台直接管理。

create table if not exists public.site_announcements (
  id boolean primary key default true check (id),
  content text not null,
  updated_at timestamptz not null default now()
);

insert into public.site_announcements (id, content)
values (true, '新品、連線與現貨資訊，請持續關注！')
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_announcements_set_updated_at on public.site_announcements;
create trigger site_announcements_set_updated_at
before update on public.site_announcements
for each row execute procedure public.set_updated_at();

alter table public.site_announcements enable row level security;

drop policy if exists "public can read site announcements" on public.site_announcements;
create policy "public can read site announcements"
on public.site_announcements
for select
to anon, authenticated
using (true);

drop policy if exists "admins can manage site announcements" on public.site_announcements;
create policy "admins can manage site announcements"
on public.site_announcements
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.site_announcements to anon, authenticated;
grant insert, update, delete on public.site_announcements to authenticated;
