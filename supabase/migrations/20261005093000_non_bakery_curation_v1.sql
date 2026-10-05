-- Non-bakery is an editorial designation, independent of catalogue category.
-- Homepage order is nullable: only selected non-bakery products are featured.
ALTER TABLE public.cms_products
  ADD COLUMN IF NOT EXISTS is_non_bakery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS non_bakery_feature_order integer;

ALTER TABLE public.cms_products
  ADD CONSTRAINT cms_products_non_bakery_feature_order_valid
  CHECK (
    non_bakery_feature_order IS NULL
    OR (is_non_bakery = true AND non_bakery_feature_order BETWEEN 1 AND 999)
  );

CREATE INDEX IF NOT EXISTS cms_products_non_bakery_active_idx
  ON public.cms_products (non_bakery_feature_order, sort_order)
  WHERE is_non_bakery = true AND is_active = true;

COMMENT ON COLUMN public.cms_products.is_non_bakery IS
  'Whether this catalogue product belongs to the public Non-bakery filter; independent of its category.';
COMMENT ON COLUMN public.cms_products.non_bakery_feature_order IS
  'Admin-controlled homepage position, null if not featured. Featured products must be non-bakery.';

-- Existing cms_products RLS already limits UPDATE to administrators while
-- SELECT permits catalogue browsing. Staff product updates intentionally do
-- not include either new editorial column.
