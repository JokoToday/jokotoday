-- Later regular payment migrations replace these functions. Reapply Specials
-- boundaries after the current main migrations while preserving regular bodies.
DO $guards$
DECLARE f record; definition text; injection text;
BEGIN
 FOR f IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('finalize_verified_payment_v1','cancel_online_order_v2') LOOP
  definition:=pg_get_functiondef(f.oid);
  IF definition !~* E'\\mBEGIN\\M[[:space:]]*\n' THEN RAISE EXCEPTION 'Unexpected payment function: %',f.proname; END IF;
  IF f.proname='finalize_verified_payment_v1' THEN
   injection:=E'BEGIN\n  PERFORM pg_advisory_xact_lock(hashtextextended(''easyslip:''||p_provider_transaction_ref,811));\n  IF EXISTS(SELECT 1 FROM specials_private.receipts WHERE provider_ref=p_provider_transaction_ref) OR EXISTS(SELECT 1 FROM public.orders o JOIN public.payment_transactions t ON t.order_id=o.id WHERE t.id=p_payment_transaction_id AND o.order_type=''specials'') THEN RAISE EXCEPTION ''Use Specials payment verification''; END IF;\n';
  ELSE
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''specials'') THEN RAISE EXCEPTION ''Use the authorized Specials workflow''; END IF;\n';
  END IF;
  EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',injection,'i');
 END LOOP;
END $guards$;
