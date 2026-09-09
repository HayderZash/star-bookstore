
-- Admin deletes an online order: restore stock, then remove the order.
CREATE OR REPLACE FUNCTION public.admin_delete_order(_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id) THEN
    RETURN 'NOT_FOUND';
  END IF;

  UPDATE public.products p
     SET stock_qty = p.stock_qty + i.qty
    FROM (SELECT product_id, sum(quantity)::int AS qty
            FROM public.order_items
           WHERE order_id = _order_id AND product_id IS NOT NULL AND is_unavailable = false
           GROUP BY product_id) i
   WHERE p.id = i.product_id;

  DELETE FROM public.order_items WHERE order_id = _order_id;
  DELETE FROM public.orders WHERE id = _order_id;
  RETURN 'OK';
END;
$$;

-- Admin deletes a cashier invoice: restore stock, then remove the sale.
CREATE OR REPLACE FUNCTION public.admin_delete_pos_sale(_sale_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pos_sales WHERE id = _sale_id) THEN
    RETURN 'NOT_FOUND';
  END IF;

  UPDATE public.products p
     SET stock_qty = p.stock_qty + i.qty
    FROM (SELECT product_id, sum(quantity)::int AS qty
            FROM public.pos_sale_items
           WHERE sale_id = _sale_id AND product_id IS NOT NULL
           GROUP BY product_id) i
   WHERE p.id = i.product_id;

  DELETE FROM public.pos_sale_items WHERE sale_id = _sale_id;
  DELETE FROM public.pos_sales WHERE id = _sale_id;
  RETURN 'OK';
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_pos_sale(uuid) TO authenticated;

INSERT INTO public.ai_settings (key, value)
VALUES ('proxy_secret', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (key) DO NOTHING;
