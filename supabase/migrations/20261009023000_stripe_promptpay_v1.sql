-- JOKO TODAY Stripe PromptPay v1
-- Adds Stripe as an optional PromptPay provider while preserving the proven
-- K SHOP + EasySlip production path and legacy PromptPay fallback.

ALTER TABLE public.payment_settings
  DROP CONSTRAINT IF EXISTS payment_settings_payment_qr_mode_check;

ALTER TABLE public.payment_settings
  ADD CONSTRAINT payment_settings_payment_qr_mode_check
  CHECK (payment_qr_mode IN ('promptpay_legacy','kshop_easyslip','kshop_master','stripe_promptpay'));

COMMENT ON COLUMN public.payment_settings.payment_qr_mode IS
'Payment provider/mode selector. kshop_master is the preferred direct K SHOP + EasySlip route; stripe_promptpay uses Stripe PaymentIntents + signed webhook confirmation; kshop_easyslip and promptpay_legacy remain fallbacks.';

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS payment_mode text;

UPDATE public.payment_transactions
SET payment_mode = CASE
  WHEN provider = 'stripe' THEN 'stripe_promptpay'
  ELSE 'kshop_master'
END
WHERE payment_mode IS NULL;

ALTER TABLE public.payment_transactions
  ALTER COLUMN payment_mode SET NOT NULL;

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_payment_mode_check;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_payment_mode_check
  CHECK (payment_mode IN ('promptpay_legacy','kshop_easyslip','kshop_master','stripe_promptpay'));

COMMENT ON COLUMN public.payment_transactions.payment_mode IS
'Immutable payment mode selected when the order payment transaction is created. Prevents an Admin mode change from mutating an already-open customer payment.';

CREATE OR REPLACE FUNCTION public.set_payment_transaction_mode_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_mode text;
BEGIN
  SELECT payment_qr_mode INTO v_mode
  FROM public.payment_settings
  WHERE id = true;

  v_mode := COALESCE(v_mode, 'kshop_master');
  NEW.payment_mode := v_mode;
  NEW.provider := CASE WHEN v_mode = 'stripe_promptpay' THEN 'stripe' ELSE 'easyslip' END;
  NEW.rail := 'promptpay';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_payment_transaction_mode_v1 ON public.payment_transactions;
CREATE TRIGGER set_payment_transaction_mode_v1
BEFORE INSERT ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.set_payment_transaction_mode_v1();

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  payment_intent_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_result text,
  last_error text
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stripe_webhook_events_admin_read ON public.stripe_webhook_events;
CREATE POLICY stripe_webhook_events_admin_read
ON public.stripe_webhook_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);
