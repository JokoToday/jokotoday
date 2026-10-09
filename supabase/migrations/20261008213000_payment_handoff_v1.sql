-- Secure cross-device payment handoff for mobile slip upload.
-- The usable handoff token is never stored; only its SHA-256 hash is persisted.

CREATE TABLE IF NOT EXISTS public.payment_handoff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id uuid NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  channel text NOT NULL DEFAULT 'mobile_web' CHECK (channel IN ('mobile_web','line')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','slip_received','verifying','verified','expired','cancelled')),
  line_user_id text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_handoff_sessions_payment_idx
  ON public.payment_handoff_sessions(payment_transaction_id, status);

CREATE INDEX IF NOT EXISTS payment_handoff_sessions_customer_idx
  ON public.payment_handoff_sessions(customer_id, created_at DESC);

ALTER TABLE public.payment_handoff_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read own payment handoffs" ON public.payment_handoff_sessions;
CREATE POLICY "Customers can read own payment handoffs"
  ON public.payment_handoff_sessions
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.payment_handoff_sessions FROM anon, authenticated;
GRANT SELECT ON public.payment_handoff_sessions TO authenticated;

COMMENT ON TABLE public.payment_handoff_sessions IS
'Short-lived cross-device payment handoffs. Bearer tokens are returned once to the customer and only SHA-256 hashes are stored.';
