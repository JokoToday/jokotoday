-- OPTIONAL production/staging operation, NOT a migration and NOT automatically executed.
-- Enable pg_cron, pg_net and Vault first. Provision the two named secrets securely.
-- Review the URL: it must target this approved Supabase project's dispatcher.
BEGIN;
DO $$BEGIN
 IF to_regclass('vault.decrypted_secrets') IS NULL OR to_regclass('cron.job') IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='net' AND p.proname='http_post') THEN RAISE EXCEPTION 'Enable Vault, pg_cron and pg_net before Cron setup';END IF;
END;$$;
CREATE OR REPLACE FUNCTION private.notification_cron_tick_v1()
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE dispatch_url text;dispatch_key text;request_id bigint;
BEGIN
 IF EXISTS(SELECT 1 FROM private.notification_control_v1 WHERE id=true AND (paused OR (email_paused AND line_paused))) THEN RETURN NULL;END IF;
 SELECT decrypted_secret INTO STRICT dispatch_url FROM vault.decrypted_secrets WHERE name='joko_customer_notification_dispatch_url';
 SELECT decrypted_secret INTO STRICT dispatch_key FROM vault.decrypted_secrets WHERE name='joko_customer_notification_dispatch_key';
 IF dispatch_url IS NULL OR dispatch_key IS NULL OR dispatch_url !~ '^https://[a-z0-9]{20}\.supabase\.co/functions/v1/dispatch-customer-notifications$' OR length(dispatch_key)<32 THEN RAISE EXCEPTION 'Invalid dispatcher configuration';END IF;
 SELECT net.http_post(url=>dispatch_url,body=>'{}'::jsonb,
 headers=>jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||dispatch_key),timeout_milliseconds=>90000) INTO request_id;
 RETURN request_id;
END;$$;
REVOKE ALL ON FUNCTION private.notification_cron_tick_v1() FROM PUBLIC,anon,authenticated,service_role;
SELECT cron.schedule('joko-customer-notifications-v1','*/5 * * * *','SELECT private.notification_cron_tick_v1();');
COMMIT;
-- Roll back scheduling separately: SELECT cron.unschedule('joko-customer-notifications-v1');
-- Keep delivery rows/provider keys. Disabling Cron does not recall an in-flight request.
