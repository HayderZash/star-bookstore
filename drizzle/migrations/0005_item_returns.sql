ALTER TABLE public.pos_sale_items ADD COLUMN IF NOT EXISTS returned_qty integer NOT NULL DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS returned_qty integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.admin_return_item(_source text, _item_id uuid, _qty integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _pid uuid; _vid uuid; _q int; _r int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _source = 'cashier' THEN
    SELECT product_id, variant_id, quantity, returned_qty INTO _pid, _vid, _q, _r
      FROM public.pos_sale_items WHERE id = _item_id FOR UPDATE;
  ELSIF _source = 'online' THEN
    SELECT product_id, NULL::uuid, quantity, returned_qty INTO _pid, _vid, _q, _r
      FROM public.order_items WHERE id = _item_id FOR UPDATE;
  ELSE RAISE EXCEPTION 'BAD_SOURCE'; END IF;
  IF _q IS NULL THEN RETURN 'NOT_FOUND'; END IF;
  -- _qty may be negative to undo a return; keep within 0..quantity
  IF _r + _qty < 0 OR _r + _qty > _q THEN RETURN 'BAD_QTY'; END IF;
  IF _source = 'cashier' THEN
    UPDATE public.pos_sale_items SET returned_qty = returned_qty + _qty WHERE id = _item_id;
  ELSE
    UPDATE public.order_items SET returned_qty = returned_qty + _qty WHERE id = _item_id;
  END IF;
  IF _pid IS NOT NULL THEN
    UPDATE public.products SET stock_qty = greatest(stock_qty + _qty, 0) WHERE id = _pid;
  END IF;
  IF _vid IS NOT NULL THEN
    UPDATE public.product_variants SET stock_qty = greatest(stock_qty + _qty, 0) WHERE id = _vid AND stock_qty > 0;
  END IF;
  RETURN 'OK';
END $$;
REVOKE ALL ON FUNCTION public.admin_return_item(text, uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_return_item(text, uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.profit_report(_from timestamp with time zone DEFAULT NULL, _to timestamp with time zone DEFAULT NULL)
 RETURNS TABLE(product_name text, source text, quantity bigint, cost_price numeric, sell_price numeric, total_cost numeric, total_sell numeric, total_profit numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH lines AS (
    SELECT oi.product_name, 'online'::text AS source,
           (oi.quantity - oi.returned_qty)::bigint AS qty,
           coalesce(nullif(oi.cost_price, 0), p.cost_price, 0) AS cost, oi.unit_price AS sell
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      LEFT JOIN public.products p ON p.id = oi.product_id
     WHERE o.status = 'completed' AND oi.is_unavailable = false
       AND (_from IS NULL OR o.created_at >= _from) AND (_to IS NULL OR o.created_at <= _to)
    UNION ALL
    SELECT si.product_name, 'cashier'::text, (si.quantity - si.returned_qty)::bigint,
           coalesce(nullif(si.cost_price, 0), p.cost_price, 0), si.unit_price
      FROM public.pos_sale_items si
      JOIN public.pos_sales s ON s.id = si.sale_id
      LEFT JOIN public.products p ON p.id = si.product_id
     WHERE (_from IS NULL OR s.created_at >= _from) AND (_to IS NULL OR s.created_at <= _to)
  )
  SELECT l.product_name, string_agg(DISTINCT l.source, '+'), sum(l.qty), round(avg(l.cost)), round(avg(l.sell)),
         sum(l.qty * l.cost), sum(l.qty * l.sell), sum(l.qty * (l.sell - l.cost))
    FROM lines l
   WHERE public.has_role(auth.uid(), 'admin') AND l.qty > 0
   GROUP BY l.product_name
   ORDER BY sum(l.qty * (l.sell - l.cost)) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.returns_report(_from timestamp with time zone DEFAULT NULL, _to timestamp with time zone DEFAULT NULL)
 RETURNS TABLE(product_name text, source text, returned_qty bigint, returned_value numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH r AS (
    SELECT oi.product_name, 'online'::text AS source, oi.returned_qty::bigint AS q, oi.unit_price AS u
      FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
     WHERE oi.returned_qty > 0 AND (_from IS NULL OR o.created_at >= _from) AND (_to IS NULL OR o.created_at <= _to)
    UNION ALL
    SELECT si.product_name, 'cashier', si.returned_qty::bigint, si.unit_price
      FROM public.pos_sale_items si JOIN public.pos_sales s ON s.id = si.sale_id
     WHERE si.returned_qty > 0 AND (_from IS NULL OR s.created_at >= _from) AND (_to IS NULL OR s.created_at <= _to)
  )
  SELECT product_name, string_agg(DISTINCT source, '+'), sum(q), sum(q * u)
    FROM r WHERE public.has_role(auth.uid(), 'admin')
   GROUP BY product_name ORDER BY sum(q * u) DESC;
$function$;
REVOKE ALL ON FUNCTION public.returns_report(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.returns_report(timestamptz, timestamptz) TO authenticated;