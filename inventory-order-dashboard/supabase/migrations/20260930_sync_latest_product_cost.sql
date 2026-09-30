-- 「最新成本」取每個商品中，下單日期與今天最接近的已入庫台幣單件成本。
-- 同日以較晚的下單日期與明細 id 作為穩定的排序規則。
with closest_costs as (
  select distinct on (poi.product_id)
    poi.product_id,
    poi.unit_cost
  from public.purchase_order_items poi
  join public.purchase_orders po on po.id = poi.purchase_order_id
  where poi.received_quantity > 0
  order by
    poi.product_id,
    abs(po.order_date - timezone('Asia/Taipei', now())::date) asc,
    po.order_date desc,
    poi.id desc
)
update public.products products
set cost = closest_costs.unit_cost,
    updated_at = now()
from closest_costs
where products.id = closest_costs.product_id
  and products.cost is distinct from closest_costs.unit_cost;
