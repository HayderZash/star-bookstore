ALTER TABLE public.pos_sale_items ADD COLUMN IF NOT EXISTS original_price numeric;
UPDATE public.pos_sale_items SET original_price = unit_price WHERE original_price IS NULL;
CREATE OR REPLACE FUNCTION public.pos_checkout(_items jsonb, _customer_name text DEFAULT ''::text, _phone text DEFAULT ''::text, _discount numeric DEFAULT 0, _note text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sale_id uuid;
  _it jsonb;
  _pid uuid;
  _qty integer;
  _p record;
  _sub numeric := 0;
  _disc numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Empty cart';
  END IF;

  INSERT INTO public.pos_sales (cashier_id, customer_name, phone, note)
  VALUES (auth.uid(), coalesce(_customer_name,''), coalesce(_phone,''), coalesce(_note,''))
  RETURNING id INTO _sale_id;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _pid := (_it->>'product_id')::uuid;
    _qty := greatest(1, coalesce((_it->>'quantity')::int, 1));
    SELECT id, name_ar, name_en, price, discount_price, cost_price, stock_qty
      INTO _p FROM public.products WHERE id = _pid FOR UPDATE;
    IF _p.id IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
    IF _p.stock_qty < _qty THEN
      RAISE EXCEPTION 'الكمية غير كافية للمادة %', coalesce(nullif(_p.name_ar,''), _p.name_en);
    END IF;

    INSERT INTO public.pos_sale_items (sale_id, product_id, product_name, quantity, unit_price, cost_price, original_price)
    VALUES (
      _sale_id, _pid, coalesce(nullif(_p.name_ar,''), _p.name_en),
      _qty,
      CASE WHEN _p.discount_price IS NOT NULL AND _p.discount_price > 0 AND _p.discount_price < _p.price
           THEN _p.discount_price ELSE _p.price END,
      _p.cost_price,
      _p.price
    );

    _sub := _sub + _qty * (CASE WHEN _p.discount_price IS NOT NULL AND _p.discount_price > 0 AND _p.discount_price < _p.price
           THEN _p.discount_price ELSE _p.price END);

    UPDATE public.products SET stock_qty = stock_qty - _qty WHERE id = _pid;
  END LOOP;

  _disc := least(greatest(coalesce(_discount,0), 0), _sub);
  UPDATE public.pos_sales
     SET subtotal = _sub, discount_amount = _disc, total_amount = _sub - _disc
   WHERE id = _sale_id;

  RETURN _sale_id;
END;
$function$;