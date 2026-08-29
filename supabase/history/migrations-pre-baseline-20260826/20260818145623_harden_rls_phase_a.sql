-- RLS Phase A: operational customer/staff data hardening
--
-- Scope:
--   * user_profiles
--   * legacy customers
--   * orders
--   * record_walk_in_purchase()
--   * confirm_order_pickup()
--
-- Goals:
--   * remove anonymous/broad reads and writes
--   * preserve customer access to their own profile/orders
--   * preserve authenticated staff/admin Pickup + Walk-In workflows
--   * preserve PR #15 staff-name enrichment without exposing customer profiles
--   * require staff/admin role checks inside SECURITY DEFINER operational RPCs

-- ---------------------------------------------------------------------------
-- Shared role helper
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is intentional here. It allows RLS policies to check the
-- caller's own application role without recursive user_profiles RLS evaluation.
-- The function returns only a boolean and exposes no profile data.
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('staff'::user_role, 'admin'::user_role)
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------------
-- QR login and staff customer lookup now use service-role Edge Functions, so
-- there is no reason for browser sessions to enumerate all user profiles.
DROP POLICY IF EXISTS "Allow public QR lookup" ON public.user_profiles;

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Staff purchase-history enrichment needs names for staff/admin handlers only.
-- Do not grant staff a general browser-level view of customer profiles.
DROP POLICY IF EXISTS "Staff can view staff directory" ON public.user_profiles;
CREATE POLICY "Staff can view staff directory"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  public.is_staff_or_admin()
  AND role IN ('staff'::user_role, 'admin'::user_role)
);

-- Keep the hardened INSERT/UPDATE rules introduced by SEC-011.
-- Remove all anonymous table privileges. Service-role Edge Functions bypass RLS.
REVOKE ALL PRIVILEGES ON TABLE public.user_profiles FROM anon;

-- Remove dangerous table-level privileges for normal authenticated sessions.
-- UPDATE remains column-scoped by 20260813204000_harden_user_profile_role.sql.
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.user_profiles FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.user_profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- legacy customers
-- ---------------------------------------------------------------------------
-- Remove legacy public lookup policies. Staff lookup goes through customer-lookup.
DROP POLICY IF EXISTS "Anyone can read customer by qr_token" ON public.customers;
DROP POLICY IF EXISTS "Public can lookup customer by short code" ON public.customers;

DROP POLICY IF EXISTS "Users can read own customer record" ON public.customers;
CREATE POLICY "Users can read own customer record"
ON public.customers
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own customer record" ON public.customers;
CREATE POLICY "Users can insert own customer record"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own customer record" ON public.customers;
CREATE POLICY "Users can update own customer record"
ON public.customers
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

REVOKE ALL PRIVILEGES ON TABLE public.customers FROM anon;

-- Legacy customer rows must not let browser sessions alter loyalty/security fields.
REVOKE UPDATE ON TABLE public.customers FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.customers FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.customers TO authenticated;
GRANT UPDATE (name, phone, line_id, whatsapp, wechat_id)
ON TABLE public.customers
TO authenticated;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
-- Remove broad legacy policies.
DROP POLICY IF EXISTS "Anyone can read orders by customer lookup" ON public.orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can insert walk-in purchases" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;

DROP POLICY IF EXISTS "Customers can read own orders" ON public.orders;
CREATE POLICY "Customers can read own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (auth.uid() = customer_id);

-- Pickup Desk, Walk-In Desk and shared purchase history need staff-wide order read.
DROP POLICY IF EXISTS "Staff can read orders" ON public.orders;
CREATE POLICY "Staff can read orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_staff_or_admin());

-- Customers may create only a normal pending/unpaid online order for themselves.
DROP POLICY IF EXISTS "Customers can insert own orders" ON public.orders;
CREATE POLICY "Customers can insert own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = customer_id
  AND COALESCE(purchase_type, 'online') = 'online'
  AND walk_in_amount IS NULL
  AND staff_id IS NULL
  AND COALESCE(status, 'pending') = 'pending'
  AND COALESCE(payment_status, 'unpaid') = 'unpaid'
  AND picked_up_at IS NULL
  AND COALESCE(loyalty_points_earned, 0) = 0
);

-- Staff browser sessions currently update payment status/method and pickup status.
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

REVOKE ALL PRIVILEGES ON TABLE public.orders FROM anon;

-- Keep only the browser privileges needed by current authenticated flows.
REVOKE UPDATE ON TABLE public.orders FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.orders FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.orders TO authenticated;
GRANT UPDATE (status, payment_status, payment_method)
ON TABLE public.orders
TO authenticated;

-- ---------------------------------------------------------------------------
-- Walk-In RPC
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is retained because this operation must atomically write the
-- order and loyalty balance. The caller role is now verified before any work.
CREATE OR REPLACE FUNCTION public.record_walk_in_purchase(
  p_customer_id uuid,
  p_amount numeric,
  p_order_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer customers%ROWTYPE;
  v_existing_order orders%ROWTYPE;
  v_multiplier numeric;
  v_points_earned integer;
  v_updated_balance integer;
  v_order_id uuid;
BEGIN
  IF NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Purchase amount must be greater than zero';
  END IF;

  IF p_order_number IS NULL OR p_order_number !~ '^WI-[A-Za-z0-9-]+$' THEN
    RAISE EXCEPTION 'Invalid walk-in purchase reference';
  END IF;

  SELECT *
  INTO v_existing_order
  FROM orders
  WHERE order_number = p_order_number;

  IF FOUND THEN
    IF v_existing_order.customer_id IS DISTINCT FROM p_customer_id
       OR v_existing_order.total_amount IS DISTINCT FROM p_amount
       OR v_existing_order.purchase_type IS DISTINCT FROM 'walk_in' THEN
      RAISE EXCEPTION 'Walk-in purchase reference conflict';
    END IF;

    SELECT COALESCE(loyalty_points, 0)
    INTO v_updated_balance
    FROM customers
    WHERE id = p_customer_id;

    RETURN jsonb_build_object(
      'order_id', v_existing_order.id,
      'order_number', v_existing_order.order_number,
      'amount', v_existing_order.total_amount,
      'points_earned', COALESCE(v_existing_order.loyalty_points_earned, 0),
      'updated_balance', v_updated_balance
    );
  END IF;

  SELECT *
  INTO v_customer
  FROM customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  SELECT COALESCE(multiplier, 0.5)
  INTO v_multiplier
  FROM loyalty_settings
  WHERE purchase_type = 'walk_in';

  v_multiplier := COALESCE(v_multiplier, 0.5);
  v_points_earned := ROUND(p_amount * v_multiplier);

  INSERT INTO orders (
    customer_id,
    purchase_type,
    walk_in_amount,
    staff_id,
    order_number,
    order_items,
    total_amount,
    status,
    payment_status,
    customer_name,
    customer_phone,
    customer_email,
    loyalty_multiplier,
    loyalty_points_earned,
    created_at
  )
  VALUES (
    v_customer.id,
    'walk_in',
    p_amount,
    auth.uid(),
    p_order_number,
    '[]'::jsonb,
    p_amount,
    'completed',
    'paid',
    v_customer.name,
    v_customer.phone,
    v_customer.email,
    v_multiplier,
    v_points_earned,
    now()
  )
  RETURNING id INTO v_order_id;

  UPDATE customers
  SET loyalty_points = COALESCE(loyalty_points, 0) + v_points_earned
  WHERE id = v_customer.id
  RETURNING loyalty_points INTO v_updated_balance;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', p_order_number,
    'amount', p_amount,
    'points_earned', v_points_earned,
    'updated_balance', v_updated_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_walk_in_purchase(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_walk_in_purchase(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_walk_in_purchase(uuid, numeric, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Pickup confirmation RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_order_pickup(p_order_id uuid)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  IF NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled orders cannot be picked up';
  END IF;

  IF v_order.status IN ('picked_up', 'completed') THEN
    RETURN NEXT v_order;
    RETURN;
  END IF;

  UPDATE orders
  SET
    status = 'picked_up',
    picked_up_at = COALESCE(picked_up_at, now()),
    staff_id = COALESCE(staff_id, auth.uid())
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN NEXT v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order_pickup(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_order_pickup(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_order_pickup(uuid) TO authenticated;

COMMENT ON FUNCTION public.confirm_order_pickup(uuid) IS
  'Idempotently marks a non-cancelled order picked_up and records its actual pickup time; staff/admin only.';
