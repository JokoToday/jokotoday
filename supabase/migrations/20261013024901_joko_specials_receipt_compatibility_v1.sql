-- Preserve the regular receipt workflow while preventing Specials side effects.
-- Runs after the deployed customer-receipt migration replaces claim_order_notification.
DO $guards$
DECLARE definition text;
BEGIN
 definition := pg_get_functiondef('public.claim_order_notification(uuid,text)'::regprocedure);
 IF definition !~* E'\\mBEGIN\\M[[:space:]]*\n' THEN
  RAISE EXCEPTION 'Unexpected claim_order_notification body';
 END IF;
 EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',
  E'BEGIN\n  IF EXISTS (SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''specials'' AND (payment_status<>''paid'' OR p_notification_type=''customer_confirmation'')) THEN RETURN jsonb_build_object(''outcome'',''unavailable''); END IF;\n','i');
 definition := pg_get_functiondef('public.complete_order_customer_receipt(text,text,timestamptz,jsonb)'::regprocedure);
 IF definition !~* E'\\mBEGIN\\M[[:space:]]*\n' THEN
  RAISE EXCEPTION 'Unexpected complete_order_customer_receipt body';
 END IF;
 EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',
  E'BEGIN\n  IF EXISTS (SELECT 1 FROM public.pickup_handoff_sessions h JOIN public.orders o ON o.id=h.order_id WHERE h.token_hash=p_token_hash AND o.order_type=''specials'') THEN RAISE EXCEPTION ''Use the Specials receipt confirmation workflow''; END IF;\n','i');
END $guards$;
