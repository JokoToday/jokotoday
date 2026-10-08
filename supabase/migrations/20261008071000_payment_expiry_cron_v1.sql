-- Schedule automatic expiry of unpaid PromptPay reservations.
-- Supabase Cron runs this database function directly; no HTTP secret is required.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

SELECT cron.schedule(
  'joko-expire-unpaid-promptpay-v1',
  '*/5 * * * *',
  $$SELECT public.expire_unpaid_payment_transactions_v1();$$
);
