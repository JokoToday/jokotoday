-- Prevent creating an online order that the active Stripe PromptPay rail
-- cannot accept. This is a server-side backstop for the customer-facing
-- checkout validation and applies only while Stripe is the active online rail.

CREATE OR REPLACE FUNCTION public.enforce_online_payment_provider_minimum_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_settings public.payment_settings%ROWTYPE;
  v_amount_due numeric(10,2);
BEGIN
  IF COALESCE(NEW.purchase_type, 'online') <> 'online' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_settings
  FROM public.payment_settings
  WHERE id = true;

  IF NOT FOUND
     OR COALESCE(v_settings.online_promptpay_enabled, false) = false
     OR COALESCE(v_settings.payment_qr_mode, 'promptpay_legacy') <> 'stripe_promptpay' THEN
    RETURN NEW;
  END IF;

  v_amount_due := round(
    COALESCE(NEW.total_amount, 0) - COALESCE(NEW.loyalty_discount_amount, 0),
    2
  );

  IF v_amount_due > 0 AND v_amount_due < 10 THEN
    RAISE EXCEPTION 'Stripe PromptPay requires a minimum payment of ฿10. Please add another item or choose another payment method.'
      USING ERRCODE = '22023',
            HINT = 'STRIPE_MINIMUM_AMOUNT';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_online_payment_provider_minimum_v1 ON public.orders;
CREATE TRIGGER enforce_online_payment_provider_minimum_v1
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_online_payment_provider_minimum_v1();

COMMENT ON FUNCTION public.enforce_online_payment_provider_minimum_v1() IS
  'Blocks online orders below the active Stripe PromptPay THB 10 minimum before inventory/order creation; other payment rails are unaffected.';
