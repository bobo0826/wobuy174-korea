-- Allow several existing products' receipt totals to be updated atomically.
-- If any selected line is invalid, PostgreSQL rolls the entire batch back.
create or replace function public.set_live_sale_received_quantities(
  p_campaign_id uuid,
  p_entries jsonb,
  p_performed_by text default ''
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_entry jsonb;
  v_product_id uuid;
  v_received_quantity integer;
  v_receipt record;
  v_results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception '請選擇至少一項商品批量更新';
  end if;

  if exists (
    select 1
    from (
      select value ->> 'productId' as product_id
      from jsonb_array_elements(p_entries)
      group by value ->> 'productId'
      having count(*) > 1
    ) as duplicates
  ) then
    raise exception '批量更新不可包含重複商品';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    if jsonb_typeof(v_entry) <> 'object'
      or coalesce(v_entry ->> 'productId', '') = ''
      or coalesce(v_entry ->> 'receivedQuantity', '') = '' then
      raise exception '批量到貨資料不正確';
    end if;

    begin
      v_product_id := (v_entry ->> 'productId')::uuid;
      v_received_quantity := (v_entry ->> 'receivedQuantity')::integer;
    exception
      when invalid_text_representation then
        raise exception '批量到貨資料格式不正確';
    end;

    if v_received_quantity < 0 then
      raise exception '到貨數量必須為零或正整數';
    end if;

    select * into v_receipt
    from public.set_live_sale_received_quantity(
      p_campaign_id,
      v_product_id,
      v_received_quantity,
      p_performed_by
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'productId', v_product_id,
      'receivedQuantity', v_receipt.received_quantity,
      'newAvailableStock', v_receipt.new_available_stock
    ));
  end loop;

  return v_results;
end;
$$;

notify pgrst, 'reload schema';
