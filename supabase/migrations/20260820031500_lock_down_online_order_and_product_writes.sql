/*
  Stage C checkout security lockdown.

  Preconditions:
  - create_online_order(...) is live and production-smoke-tested.
  - online checkout no longer inserts orders or mutates cms_products directly.
  - Admin CMS authenticates through Supabase and authorizes role='admin'.

  This migration deliberately does NOT change order cancellation. The legacy
  cancellation UI still needs a dedicated cancel_order RPC follow-up.
*/

-- Online customers must create orders only through create_online_order().
-- Customer and staff SELECT policies remain unchanged.
REVOKE INSERT ON TABLE public.orders FROM authenticated;
DROP POLICY IF EXISTS "Customers can insert own orders" ON public.orders;

-- Public catalogue reads remain available, but anonymous callers must never
-- be able to mutate product catalogue or inventory data.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON TABLE public.cms_products
  FROM anon;

-- Authenticated browser sessions only need normal DML for the Admin CMS.
-- Remove dangerous table-management privileges that the application does not use.
REVOKE TRUNCATE, TRIGGER, REFERENCES
  ON TABLE public.cms_products
  FROM authenticated;

DROP POLICY IF EXISTS "Products can be inserted by anyone" ON public.cms_products;
DROP POLICY IF EXISTS "Products can be updated by anyone" ON public.cms_products;
DROP POLICY IF EXISTS "Products can be deleted by anyone" ON public.cms_products;

CREATE POLICY "Admins can insert products"
ON public.cms_products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can update products"
ON public.cms_products
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can delete products"
ON public.cms_products
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);
