-- Read-only checks after an explicitly authorized migration application.
SELECT n.nspname, p.proname, p.prosecdef, p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='specials_private' OR p.proname='admin_specials_action_v1';
SELECT tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' AND tablename IN ('specials_batches','specials_items','specials_audit_events');
SELECT c.relname,c.relrowsecurity,
  has_table_privilege('anon',c.oid,'SELECT') AS anon_read,
  has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_read,
  has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') AS authenticated_write,
  has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE') AS service_write
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('specials_batches','specials_items','specials_audit_events');
SELECT i.id, i.quantity_allocated, i.quantity_available, i.quantity_held, i.quantity_committed,
  coalesce(sum(e.quantity_delta),0) AS ledger_allocated
FROM public.specials_items i LEFT JOIN public.specials_audit_events e ON e.item_id=i.id
GROUP BY i.id
HAVING i.quantity_allocated <> coalesce(sum(e.quantity_delta),0)
    OR i.quantity_allocated <> i.quantity_available+i.quantity_held+i.quantity_committed;
-- Expected: no inventory mismatches; no direct writes/anon reads; RLS true;
-- authenticated RPC/helper execution only, with explicit Admin checks in body.
