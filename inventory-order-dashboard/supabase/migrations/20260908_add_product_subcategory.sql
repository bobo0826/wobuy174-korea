-- 商品分類改為「國家 → 分類 → 子分類」三級；既有商品保留原資料，子分類預設空白。
alter table public.products
  add column if not exists subcategory text not null default '';

create index if not exists products_country_category_subcategory_idx
  on public.products(country, category, subcategory);

notify pgrst, 'reload schema';
