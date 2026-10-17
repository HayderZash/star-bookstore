ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS is_out boolean NOT NULL DEFAULT false;