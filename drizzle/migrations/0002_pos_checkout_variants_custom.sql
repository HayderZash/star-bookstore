CREATE OR REPLACE FUNCTION public.pos_checkout(_items jsonb, _customer_name text DEFAULT ''::text, _phone text DEFAULT ''::text, _discount numeric DEFAULT 0, _note text DEFAULT ''::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _sale_id uuid; _it jsonb; _pid uuid; _vid uuid; _qty integer; _p record; _v record;
  _sub numeric := 0; _disc numeric; _unit numeric; _orig numeric; _name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Empty cart'; END IF;

  INSERT INTO public.pos_sales (cashier_id, customer_name, phone, note)
  VALUES (auth.uid(), coalesce(_customer_name,''), coalesce(_phone,''), coalesce(_note,''))
  RETURNING id INTO _sale_id;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := greatest(1, coalesce((_it->>'quantity')::int, 1));
    _pid := nullif(_it->>'product_id','')::uuid;
    IF _pid IS NULL THEN
      -- Custom item not in the catalogue: no stock, no cost.
      _name := coalesce(nullif(trim(_it->>'name'),''), 'عنصر غير موجود');
      _unit := greatest(0, coalesce((_it->>'price')::numeric, 0));
      INSERT INTO public.pos_sale_items (sale_id, product_id, product_name, quantity, unit_price, cost_price, original_price)
      VALUES (_sale_id, NULL, _name, _qty, _unit, 0, _unit);
      _sub := _sub + _qty * _unit;
      CONTINUE;
    END IF;
    SELECT id, name_ar, name_en, price, discount_price, cost_price, stock_qty INTO _p
      FROM public.products WHERE id = _pid FOR UPDATE;
    IF _p.id IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
    _name := coalesce(nullif(_p.name_ar,''), _p.name_en);
    _unit := CASE WHEN _p.discount_price IS NOT NULL AND _p.discount_price > 0 AND _p.discount_price < _p.price
                  THEN _p.discount_price ELSE _p.price END;
    _orig := _p.price;
    _vid := nullif(_it->>'variant_id','')::uuid;
    IF _vid IS NOT NULL THEN
      SELECT id, value_ar, price_delta, stock_qty INTO _v FROM public.product_variants
        WHERE id = _vid AND product_id = _pid FOR UPDATE;
      IF _v.id IS NULL THEN RAISE EXCEPTION 'Variant not found'; END IF;
      IF _v.stock_qty < _qty THEN RAISE EXCEPTION 'الكمية غير كافية للمادة % - %', _name, _v.value_ar; END IF;
      _name := _name || ' - ' || _v.value_ar;
      _unit := _unit + _v.price_delta; _orig := _orig + _v.price_delta;
      UPDATE public.product_variants SET stock_qty = stock_qty - _qty WHERE id = _vid;
    END IF;
    IF _p.stock_qty < _qty THEN RAISE EXCEPTION 'الكمية غير كافية للمادة %', _name; END IF;
    INSERT INTO public.pos_sale_items (sale_id, product_id, product_name, quantity, unit_price, cost_price, original_price)
    VALUES (_sale_id, _pid, _name, _qty, _unit, _p.cost_price, _orig);
    _sub := _sub + _qty * _unit;
    UPDATE public.products SET stock_qty = stock_qty - _qty WHERE id = _pid;
  END LOOP;

  _disc := least(greatest(coalesce(_discount,0), 0), _sub);
  UPDATE public.pos_sales SET subtotal = _sub, discount_amount = _disc, total_amount = _sub - _disc WHERE id = _sale_id;
  RETURN _sale_id;
END;
$function$;