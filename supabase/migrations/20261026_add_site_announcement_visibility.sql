-- Allow each storefront announcement to be kept as a draft without displaying it.
alter table public.site_announcement_items
add column if not exists enabled boolean not null default true;
