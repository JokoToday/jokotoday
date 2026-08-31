/*
  Supabase Security Advisor cleanup pass.

  Scope:
    - convert public recommendation/like views to SECURITY INVOKER
    - pin search_path on legacy public functions
    - remove legacy unrestricted LINE-user inserts
    - remove broad SELECT/listing policies from already-public storage buckets
    - remove REST/RPC execution from trigger-only SECURITY DEFINER functions
    - keep create_user_profile_with_qr authenticated-only

  Intentional residual Advisor warnings after this migration:
    - authenticated execution of cancel_online_order()
    - authenticated execution of confirm_order_pickup()
    - authenticated execution of create_online_order()
    - authenticated execution of is_staff_or_admin()
    - authenticated execution of record_walk_in_purchase()

  Those SECURITY DEFINER functions are intentional, have fixed search_path values,
  and implement application authorization / RLS support.
*/

-- ---------------------------------------------------------------------------
-- 1. SECURITY DEFINER views -> SECURITY INVOKER
-- ---------------------------------------------------------------------------
ALTER VIEW public.product_like_counts
  SET (security_invoker = true);

ALTER VIEW public.top_liked_products
  SET (security_invoker = true);

ALTER VIEW public.product_also_liked
  SET (security_invoker = true);

ALTER VIEW public.product_recommendations
  SET (security_invoker = true);

-- ---------------------------------------------------------------------------
-- 2. Pin mutable function search paths
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.update_user_profiles_updated_at()
  SET search_path = public;

ALTER FUNCTION public.update_orders_updated_at()
  SET search_path = public;

ALTER FUNCTION public.generate_qr_token()
  SET search_path = public;

ALTER FUNCTION public.create_user_profile_with_qr(text, text, text, text, text, text, text)
  SET search_path = public;

ALTER FUNCTION public.generate_next_short_code()
  SET search_path = public;

ALTER FUNCTION public.sync_loyalty_points_per_baht()
  SET search_path = public;

ALTER FUNCTION public.update_cancellation_cutoff_updated_at()
  SET search_path = public;

ALTER FUNCTION public.initialize_stock_remaining()
  SET search_path = public;

-- ---------------------------------------------------------------------------
-- 3. Remove legacy unrestricted LINE-user writes
-- ---------------------------------------------------------------------------
-- This policy was introduced only for testing/demo purposes. JOKO TODAY no
-- longer uses public LINE OAuth inserts as an authentication path.
DROP POLICY IF EXISTS "Anyone can create LINE users"
  ON public.line_users;

REVOKE INSERT ON TABLE public.line_users FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Remove bucket-listing policies from already-public buckets
-- ---------------------------------------------------------------------------
-- Public object URLs remain accessible because the buckets themselves are
-- public. These SELECT policies only expose Storage listing/API reads.
DROP POLICY IF EXISTS "Public read access for assets"
  ON storage.objects;

DROP POLICY IF EXISTS "Public can view product QR codes"
  ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view profile pictures"
  ON storage.objects;

-- ---------------------------------------------------------------------------
-- 5. Trigger-only SECURITY DEFINER functions must not be public RPCs
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.calculate_loyalty_points_on_order()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_completed_user_profile_to_customer()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_customer_loyalty_balance()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Profile creation RPC is authenticated-only
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_user_profile_with_qr(text, text, text, text, text, text, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_user_profile_with_qr(text, text, text, text, text, text, text)
  TO authenticated;
