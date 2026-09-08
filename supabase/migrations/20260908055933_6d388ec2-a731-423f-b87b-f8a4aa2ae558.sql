-- 1) Base (cost) price on products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price numeric NOT NULL DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS cost_price numeric NOT NULL DEFAULT 0;

-- backfill: current products.price is the pre-markup base cost
UPDATE public.products SET cost_price = price WHERE cost_price = 0;

-- 2) Cashier (POS) sales
CREATE TABLE IF NOT EXISTS public.pos_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number serial NOT NULL,
  cashier_id uuid,
  customer_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_sales TO authenticated;
GRANT ALL ON public.pos_sales TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pos_sales_sale_number_seq TO authenticated, service_role;
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos sales admin all" ON public.pos_sales FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.pos_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  cost_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_sale_items TO authenticated;
GRANT ALL ON public.pos_sale_items TO service_role;
ALTER TABLE public.pos_sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos sale items admin all" ON public.pos_sale_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS pos_sale_items_sale_idx ON public.pos_sale_items(sale_id);
CREATE INDEX IF NOT EXISTS pos_sales_created_idx ON public.pos_sales(created_at DESC);

-- 3) Cashier checkout: decrements stock and writes the sale atomically
CREATE OR REPLACE FUNCTION public.pos_checkout(
  _items jsonb,
  _customer_name text DEFAULT '',
  _phone text DEFAULT '',
  _discount numeric DEFAULT 0,
  _note text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

    INSERT INTO public.pos_sale_items (sale_id, product_id, product_name, quantity, unit_price, cost_price)
    VALUES (
      _sale_id, _pid, coalesce(nullif(_p.name_ar,''), _p.name_en),
      _qty,
      CASE WHEN _p.discount_price IS NOT NULL AND _p.discount_price > 0 AND _p.discount_price < _p.price
           THEN _p.discount_price ELSE _p.price END,
      _p.cost_price
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
$$;

-- 4) Profit report (admin only): sold items from online orders + cashier sales
CREATE OR REPLACE FUNCTION public.profit_report(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
RETURNS TABLE(
  product_name text,
  source text,
  quantity bigint,
  cost_price numeric,
  sell_price numeric,
  total_cost numeric,
  total_sell numeric,
  total_profit numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH lines AS (
    SELECT oi.product_name,
           'online'::text AS source,
           oi.quantity::bigint AS qty,
           coalesce(nullif(oi.cost_price, 0), p.cost_price, 0) AS cost,
           oi.unit_price AS sell
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      LEFT JOIN public.products p ON p.id = oi.product_id
     WHERE o.status = 'completed'
       AND oi.is_unavailable = false
       AND (_from IS NULL OR o.created_at >= _from)
       AND (_to IS NULL OR o.created_at <= _to)
    UNION ALL
    SELECT si.product_name,
           'cashier'::text,
           si.quantity::bigint,
           coalesce(nullif(si.cost_price, 0), p.cost_price, 0),
           si.unit_price
      FROM public.pos_sale_items si
      JOIN public.pos_sales s ON s.id = si.sale_id
      LEFT JOIN public.products p ON p.id = si.product_id
     WHERE (_from IS NULL OR s.created_at >= _from)
       AND (_to IS NULL OR s.created_at <= _to)
  )
  SELECT l.product_name,
         string_agg(DISTINCT l.source, '+') AS source,
         sum(l.qty) AS quantity,
         round(avg(l.cost)) AS cost_price,
         round(avg(l.sell)) AS sell_price,
         sum(l.qty * l.cost) AS total_cost,
         sum(l.qty * l.sell) AS total_sell,
         sum(l.qty * (l.sell - l.cost)) AS total_profit
    FROM lines l
   WHERE public.has_role(auth.uid(), 'admin')
   GROUP BY l.product_name
   ORDER BY sum(l.qty * (l.sell - l.cost)) DESC;
$$;

REVOKE ALL ON FUNCTION public.pos_checkout(jsonb, text, text, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.pos_checkout(jsonb, text, text, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public.profit_report(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.profit_report(timestamptz, timestamptz) TO authenticated;