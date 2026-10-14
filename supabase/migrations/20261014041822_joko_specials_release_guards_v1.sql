-- Preserve Specials exclusions after notification preferences replace the legacy claim.
-- Keep bank-transfer refund records separate from automatic Stripe refund evidence.
BEGIN;
DO $guards$
DECLARE definition text;
BEGIN
 definition := pg_get_functiondef('public.claim_order_notification(uuid,text)'::regprocedure);
 IF position('order_type=''specials''' IN definition)=0 THEN
  IF definition !~* E'\\mBEGIN\\M[[:space:]]*\n' THEN RAISE EXCEPTION 'Unexpected claim_order_notification body'; END IF;
  EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',
   E'BEGIN\n  IF EXISTS (SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''specials'' AND (payment_status<>''paid'' OR p_notification_type=''customer_confirmation'')) THEN RETURN jsonb_build_object(''outcome'',''unavailable''); END IF;\n','i');
 END IF;
 definition := pg_get_functiondef('specials_private.operational_action(text,jsonb,uuid)'::regprocedure);
 IF position('Use automatic Stripe refund reconciliation' IN definition)=0 THEN
  IF definition !~* E'\\mBEGIN\\M[[:space:]]*\n' THEN RAISE EXCEPTION 'Unexpected operational_action body'; END IF;
  EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',
   E'BEGIN\n  IF p_action IN (''refund'',''refund_pending'') AND coalesce(p_request->>''reference'','''') LIKE ''stripe:%'' THEN RAISE EXCEPTION ''Use automatic Stripe refund reconciliation''; END IF;\n','i');
 END IF;
END $guards$;
COMMIT;
