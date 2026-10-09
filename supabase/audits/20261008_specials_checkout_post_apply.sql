-- Read-only post-apply audit; inspect outputs, do not change configuration here.
SELECT id,title,status,business_date FROM public.specials_batches ORDER BY created_at DESC LIMIT 10;
SELECT order_id,inventory_state,financial_state,fulfillment_state,payment_deadline,verification_deadline FROM public.specials_checkouts ORDER BY created_at DESC LIMIT 10;
SELECT id FROM public.specials_items WHERE quantity_allocated<>quantity_available+quantity_held+quantity_committed OR least(quantity_available,quantity_held,quantity_committed)<0;
SELECT table_name,privilege_type,grantee FROM information_schema.role_table_grants WHERE table_schema='specials_private' AND grantee IN ('anon','authenticated','service_role');
SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('specials_checkouts','specials_line_outbox');
SELECT proname,prosecdef,proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='specials_private';
SELECT p.proname,has_function_privilege('authenticated',p.oid,'EXECUTE') AS browser_execute,has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'specials_%';
SELECT batch_id,status,attempt_count,first_attempt_at,accepted_request_id,last_error FROM public.specials_line_outbox;
SELECT jobname,schedule,active FROM cron.job WHERE jobname='joko-specials-expiry-v1';
-- Configuration should stay disabled until the pilot; do not print QR/bank data.
SELECT enabled,updated_at FROM specials_private.settings;
-- Compatibility guards must survive the regular timeout/reactivation migration.
SELECT p.proname,
 position('specials_private.reap_batch' in pg_get_functiondef(p.oid))>0 AS specials_expiry_dispatch,
 position('authorized Specials workflow' in pg_get_functiondef(p.oid))>0 AS specials_workflow_guard
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('expire_payment_transaction_v1','expire_own_payment_transaction_v1','reactivate_expired_online_order_v1');
SELECT tgname,tgenabled FROM pg_trigger WHERE tgrelid='public.payment_handoff_sessions'::regclass AND tgname='specials_payment_handoff_guard';
