-- Secure cross-device payment slip handoff.
-- The usable bearer token is never stored; only its SHA-256 hash is persisted.

CREATE TABLE IF NOT EXISTS public.payment_handoff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id uuid NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  channel text NOT NULL DEFAULT 'phone_web',
  line_user_id text NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','slip_received','verifying','verified','expired','cancelled')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_handoff_sessions_payment_idx
  ON public.payment_handoff_sessions(payment_transaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_handoff_sessions_customer_idx
  ON public.payment_handoff_sessions(customer_id, created_at DESC);

ALTER TABLE public.payment_handoff_sessions ENABLE ROW LEVEL SECURITY;

-- Customer browsers do not need direct table access; Edge Functions use the
-- service role and return only the minimum safe handoff/status payload.
REVOKE ALL ON public.payment_handoff_sessions FROM anon, authenticated;

COMMENT ON TABLE public.payment_handoff_sessions IS
'Short-lived, bearer-token payment handoffs for moving bank-slip upload from desktop checkout to a phone. Stores only SHA-256 token hashes.';
