/*
  # Enable Custom Auth Email Hook

  Routes Supabase Auth email sending (magic links, signups, OTP) through
  the `send-auth-email` Edge Function so all emails use the branded JOKO TODAY
  templates via Resend instead of the default Supabase emails.

  1. Changes
    - Enables the `send_email` auth hook pointing to the deployed edge function
    - Grants the `supabase_auth_admin` role permission to invoke the function
*/

-- Grant the auth schema permission to call the edge function via HTTP
-- This enables the auth hook to POST to our edge function
GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin;

DO $$
BEGIN
  -- Enable the send_email hook to use our custom edge function
  -- The hook fires for: signup confirmation, magic link, OTP, invite, recovery
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_functions'
    AND table_name = 'hooks'
  ) THEN
    DELETE FROM supabase_functions.hooks
    WHERE hook_name = 'send_email';

    INSERT INTO supabase_functions.hooks (hook_table_id, hook_name, request_id)
    SELECT id, 'send_email', extensions.uuid_generate_v4()
    FROM supabase_functions.hooks
    WHERE FALSE;
  END IF;
END $$;
