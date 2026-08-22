/*
  RLS Phase B: finish CMS/admin write authorization hardening.

  Scope:
    - cms_categories
    - cms_pages
    - cms_labels
    - cms_settings
    - cms_pickup_locations
    - cms_pickup_days
    - site_social_links
    - cancellation_cutoff_rules

  Already hardened elsewhere and deliberately left unchanged here:
    - cms_products
    - pickup_cutoff_rules
    - pickup_overrides

  Goals:
    - preserve existing public/read-only website behavior
    - remove anonymous CMS writes at the privilege layer
    - replace legacy "by anyone" / any-authenticated write policies with
      role='admin' authorization
    - preserve the current authenticated Admin CMS write workflows
    - allow admins to see inactive social links and cancellation rules while
      public readers continue to see only active rows
*/

BEGIN;

-- ---------------------------------------------------------------------------
-- Defense in depth: all exposed CMS/config tables remain protected by RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE public.cms_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_pickup_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_pickup_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_cutoff_rules ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Table privileges.
--
-- Public SELECT behavior is intentionally not changed in this migration.
-- Anonymous callers must never be able to mutate CMS/configuration data.
-- Authenticated sessions retain normal DML capability so the Admin CMS can
-- operate, but RLS below restricts those writes to role='admin'.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
ON TABLE
  public.cms_categories,
  public.cms_pages,
  public.cms_labels,
  public.cms_settings,
  public.cms_pickup_locations,
  public.cms_pickup_days,
  public.site_social_links,
  public.cancellation_cutoff_rules
FROM anon;

REVOKE TRUNCATE, TRIGGER, REFERENCES
ON TABLE
  public.cms_categories,
  public.cms_pages,
  public.cms_labels,
  public.cms_settings,
  public.cms_pickup_locations,
  public.cms_pickup_days,
  public.site_social_links,
  public.cancellation_cutoff_rules
FROM authenticated;

GRANT INSERT, UPDATE, DELETE
ON TABLE
  public.cms_categories,
  public.cms_pages,
  public.cms_labels,
  public.cms_settings,
  public.cms_pickup_locations,
  public.cms_pickup_days,
  public.site_social_links
TO authenticated;

-- Cancellation rules are soft-deactivated by the current Admin CMS; no browser
-- DELETE path is required. Keep DELETE unavailable at the privilege layer.
REVOKE DELETE ON TABLE public.cancellation_cutoff_rules FROM authenticated;
GRANT INSERT, UPDATE ON TABLE public.cancellation_cutoff_rules TO authenticated;

-- ---------------------------------------------------------------------------
-- cms_categories
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Categories can be inserted by anyone" ON public.cms_categories;
DROP POLICY IF EXISTS "Categories can be updated by anyone" ON public.cms_categories;
DROP POLICY IF EXISTS "Categories can be deleted by anyone" ON public.cms_categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON public.cms_categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.cms_categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.cms_categories;

CREATE POLICY "Admins can insert categories"
ON public.cms_categories
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can update categories"
ON public.cms_categories
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can delete categories"
ON public.cms_categories
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- cms_pages
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Pages can be inserted by anyone" ON public.cms_pages;
DROP POLICY IF EXISTS "Pages can be updated by anyone" ON public.cms_pages;
DROP POLICY IF EXISTS "Pages can be deleted by anyone" ON public.cms_pages;
DROP POLICY IF EXISTS "Admins can insert pages" ON public.cms_pages;
DROP POLICY IF EXISTS "Admins can update pages" ON public.cms_pages;
DROP POLICY IF EXISTS "Admins can delete pages" ON public.cms_pages;

CREATE POLICY "Admins can insert pages"
ON public.cms_pages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can update pages"
ON public.cms_pages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can delete pages"
ON public.cms_pages
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- cms_labels
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Labels can be inserted by anyone" ON public.cms_labels;
DROP POLICY IF EXISTS "Labels can be updated by anyone" ON public.cms_labels;
DROP POLICY IF EXISTS "Labels can be deleted by anyone" ON public.cms_labels;
DROP POLICY IF EXISTS "Admins can insert labels" ON public.cms_labels;
DROP POLICY IF EXISTS "Admins can update labels" ON public.cms_labels;
DROP POLICY IF EXISTS "Admins can delete labels" ON public.cms_labels;

CREATE POLICY "Admins can insert labels"
ON public.cms_labels
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can update labels"
ON public.cms_labels
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can delete labels"
ON public.cms_labels
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- cms_settings
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Settings can be inserted by anyone" ON public.cms_settings;
DROP POLICY IF EXISTS "Settings can be updated by anyone" ON public.cms_settings;
DROP POLICY IF EXISTS "Settings can be deleted by anyone" ON public.cms_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.cms_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.cms_settings;
DROP POLICY IF EXISTS "Admins can delete settings" ON public.cms_settings;

CREATE POLICY "Admins can insert settings"
ON public.cms_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can update settings"
ON public.cms_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can delete settings"
ON public.cms_settings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- cms_pickup_locations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Pickup locations can be inserted by anyone" ON public.cms_pickup_locations;
DROP POLICY IF EXISTS "Pickup locations can be updated by anyone" ON public.cms_pickup_locations;
DROP POLICY IF EXISTS "Pickup locations can be deleted by anyone" ON public.cms_pickup_locations;
DROP POLICY IF EXISTS "Admins can insert pickup locations" ON public.cms_pickup_locations;
DROP POLICY IF EXISTS "Admins can update pickup locations" ON public.cms_pickup_locations;
DROP POLICY IF EXISTS "Admins can delete pickup locations" ON public.cms_pickup_locations;

CREATE POLICY "Admins can insert pickup locations"
ON public.cms_pickup_locations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can update pickup locations"
ON public.cms_pickup_locations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can delete pickup locations"
ON public.cms_pickup_locations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- cms_pickup_days
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Pickup days can be inserted by anyone" ON public.cms_pickup_days;
DROP POLICY IF EXISTS "Pickup days can be updated by anyone" ON public.cms_pickup_days;
DROP POLICY IF EXISTS "Pickup days can be deleted by anyone" ON public.cms_pickup_days;
DROP POLICY IF EXISTS "Admins can insert pickup days" ON public.cms_pickup_days;
DROP POLICY IF EXISTS "Admins can update pickup days" ON public.cms_pickup_days;
DROP POLICY IF EXISTS "Admins can delete pickup days" ON public.cms_pickup_days;

CREATE POLICY "Admins can insert pickup days"
ON public.cms_pickup_days
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can update pickup days"
ON public.cms_pickup_days
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can delete pickup days"
ON public.cms_pickup_days
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- site_social_links
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can manage social links" ON public.site_social_links;
DROP POLICY IF EXISTS "Authenticated users can insert social links" ON public.site_social_links;
DROP POLICY IF EXISTS "Authenticated users can update social links" ON public.site_social_links;
DROP POLICY IF EXISTS "Authenticated users can delete social links" ON public.site_social_links;
DROP POLICY IF EXISTS "Admins can view all social links" ON public.site_social_links;
DROP POLICY IF EXISTS "Admins can insert social links" ON public.site_social_links;
DROP POLICY IF EXISTS "Admins can update social links" ON public.site_social_links;
DROP POLICY IF EXISTS "Admins can delete social links" ON public.site_social_links;

CREATE POLICY "Admins can view all social links"
ON public.site_social_links
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can insert social links"
ON public.site_social_links
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can update social links"
ON public.site_social_links
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can delete social links"
ON public.site_social_links
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- cancellation_cutoff_rules
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert cancellation cutoff rules" ON public.cancellation_cutoff_rules;
DROP POLICY IF EXISTS "Authenticated users can update cancellation cutoff rules" ON public.cancellation_cutoff_rules;
DROP POLICY IF EXISTS "Admins can view all cancellation cutoff rules" ON public.cancellation_cutoff_rules;
DROP POLICY IF EXISTS "Admins can insert cancellation cutoff rules" ON public.cancellation_cutoff_rules;
DROP POLICY IF EXISTS "Admins can update cancellation cutoff rules" ON public.cancellation_cutoff_rules;

CREATE POLICY "Admins can view all cancellation cutoff rules"
ON public.cancellation_cutoff_rules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can insert cancellation cutoff rules"
ON public.cancellation_cutoff_rules
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can update cancellation cutoff rules"
ON public.cancellation_cutoff_rules
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
  )
);

COMMIT;
