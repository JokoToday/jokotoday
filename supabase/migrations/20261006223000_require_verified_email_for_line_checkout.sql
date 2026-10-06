-- LINE onboarding v1.1 (review only; do not apply to live Supabase until
-- PR review and staged verification are complete).
--
-- Frontend checkout gates alone are bypassable via direct RPC calls. Both
-- create_online_order and create_online_order_v2 insert into public.orders,
-- so a narrowly scoped BEFORE INSERT guard protects LINE-authenticated
-- customers even if an API caller tries to spoof purchase_type. It does
-- not change staff-created walk-ins/desk sales.
--
-- Rollback:
-- DROP TRIGGER IF EXISTS require_line_email_for_online_order ON public.orders;
-- DROP FUNCTION IF EXISTS public.require_line_email_for_online_order();

CREATE OR REPLACE FUNCTION public.require_line_email_for_online_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only customer-initiated INSERTs. Do not trust purchase_type as a
  -- client can spoof it. Staff/POS orders where the staff is the actor
  -- rather than the customer, and guest desk orders are untouched.
  IF auth.uid() IS NULL
     OR NEW.customer_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  -- The login identity is verified by Supabase. LINE does not provide an
  -- email or its verification. Never trust user_profiles.email, LINE IDs,
  -- unaudited user_metadata, or claims supplied by the browser for this rule.
  IF EXISTS (
    SELECT 1 FROM auth.identities AS i
    WHERE i.user_id = NEW.customer_id AND i.provider = 'custom:line'
  ) AND NOT EXISTS (
    SELECT 1 FROM auth.users AS u
    WHERE u.id = NEW.customer_id
      AND NULLIF(btrim(u.email), '') IS NOT NULL
      AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Verify your email in My Profile before placing an online order'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_line_email_for_online_order ON public.orders;

CREATE TRIGGER require_line_email_for_online_order
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.require_line_email_for_online_order();

COMMENT ON FUNCTION public.require_line_email_for_online_order() IS
  'Require confirmed email for customer-created orders using LINE identity; staff-created walk-ins unaffected.';
