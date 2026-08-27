/*
  JOKO TODAY — Loyalty v2 calculator hardening

  Earning rates are Admin configuration. Missing configuration must never fall
  back silently to a hard-coded percentage or to another purchase channel.
*/

CREATE OR REPLACE FUNCTION public.calculate_loyalty_points_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate numeric;
  v_purchase_type text;
BEGIN
  v_purchase_type := COALESCE(NEW.purchase_type, 'online');

  SELECT ls.points_per_baht
  INTO v_rate
  FROM public.loyalty_settings ls
  WHERE ls.purchase_type = v_purchase_type;

  -- No configured rule means zero prospective points. Admin can deliberately
  -- configure any percentage through admin_update_loyalty_earning_rule_v2().
  v_rate := COALESCE(v_rate, 0);

  NEW.loyalty_points_earned := round(COALESCE(NEW.total_amount, 0) * v_rate);
  NEW.loyalty_multiplier := v_rate;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_loyalty_points_on_order() FROM PUBLIC, anon, authenticated;
