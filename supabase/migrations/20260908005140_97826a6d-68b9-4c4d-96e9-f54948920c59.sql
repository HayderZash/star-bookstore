CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_ar text NOT NULL DEFAULT '',
  group_en text NOT NULL DEFAULT '',
  value_ar text NOT NULL DEFAULT '',
  value_en text NOT NULL DEFAULT '',
  price_delta numeric NOT NULL DEFAULT 0,
  stock_qty integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "variants public read" ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "variants admin write" ON public.product_variants FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX product_variants_product_idx ON public.product_variants(product_id);

DROP TABLE IF EXISTS public.solar_components;