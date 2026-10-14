-- New checkouts default to Stripe. Existing snapshots retain their original rail.
ALTER TABLE specials_private.settings ADD COLUMN payment_mode text NOT NULL DEFAULT 'stripe_promptpay' CHECK(payment_mode IN ('stripe_promptpay','kshop_master'));
ALTER TABLE public.specials_checkouts ADD COLUMN payment_mode text NOT NULL DEFAULT 'kshop_master' CHECK(payment_mode IN ('stripe_promptpay','kshop_master'));
ALTER TABLE specials_private.settings DROP CONSTRAINT specials_static_merchant_qr;
ALTER TABLE specials_private.settings ADD CONSTRAINT specials_static_merchant_qr CHECK(NOT enabled OR payment_mode='stripe_promptpay' OR specials_private.valid_merchant_qr(qr_payload));

ALTER FUNCTION specials_private.admin_action(text,jsonb,uuid) RENAME TO single_rail_admin_action;
CREATE FUNCTION specials_private.admin_action(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s specials_private.settings%ROWTYPE; mode text:=coalesce(p_request->>'payment_mode','stripe_promptpay');
BEGIN
 IF p_action IS DISTINCT FROM 'settings' THEN RETURN specials_private.single_rail_admin_action(p_action,p_request,p_operation_key); END IF;
 IF NOT specials_private.is_admin() OR p_operation_key IS NULL THEN RAISE EXCEPTION 'Admin and operation key required' USING ERRCODE='42501'; END IF;
 IF mode NOT IN ('stripe_promptpay','kshop_master') THEN RAISE EXCEPTION 'Unsupported payment method'; END IF;
 IF mode='kshop_master' AND coalesce((p_request->>'enabled')::boolean,false) AND
 (NOT specials_private.valid_merchant_qr(p_request->>'qr_payload') OR coalesce(p_request->>'receiver_bank_code','')='' OR length(regexp_replace(coalesce(p_request->>'receiver_bank_number',''),'[^0-9]','','g'))<6 OR coalesce(p_request->>'receiver_label','')='') THEN RAISE EXCEPTION 'Approved merchant QR and exact registered receiver required'; END IF;
 UPDATE specials_private.settings SET payment_mode=mode,enabled=coalesce((p_request->>'enabled')::boolean,false),qr_payload=coalesce(p_request->>'qr_payload',''),receiver_bank_code=upper(trim(coalesce(p_request->>'receiver_bank_code',''))),receiver_bank_number=coalesce(p_request->>'receiver_bank_number',''),receiver_label=coalesce(p_request->>'receiver_label',''),updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id RETURNING * INTO s;
 RETURN jsonb_build_object('settings',to_jsonb(s));
END $$;
REVOKE ALL ON FUNCTION specials_private.single_rail_admin_action(text,jsonb,uuid),specials_private.admin_action(text,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION specials_private.admin_action(text,jsonb,uuid) TO authenticated;

DO $patch$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('specials_private.checkout(uuid,jsonb,uuid)'::regprocedure);
 IF strpos(definition,'operation_key,request,inventory_state,payment_deadline')=0 THEN RAISE EXCEPTION 'Unexpected checkout function'; END IF;
 definition:=replace(definition,'operation_key,request,inventory_state,payment_deadline','operation_key,request,payment_mode,inventory_state,payment_deadline');
 definition:=replace(definition,'VALUES(oid,b.id,auth.uid(),p_key,p_cart,''held'',','VALUES(oid,b.id,auth.uid(),p_key,p_cart,s.payment_mode,''held'',');
 definition:=replace(definition,'IF t>=b.sales_end_at-interval ''5 minutes''', 'IF s.payment_mode=''stripe_promptpay'' AND total<1000 THEN RAISE EXCEPTION ''Stripe PromptPay requires at least THB 10''; END IF; IF t>=b.sales_end_at-interval ''5 minutes''');
 EXECUTE definition;
 -- EasySlip cannot attest to a checkout frozen to Stripe.
 definition:=pg_get_functiondef('specials_private.begin_verification(uuid,uuid,uuid,text)'::regprocedure);
 definition:=replace(definition,'IF NOT FOUND THEN RAISE EXCEPTION ''Checkout not found''; END IF;', 'IF NOT FOUND THEN RAISE EXCEPTION ''Checkout not found''; END IF; IF c.payment_mode<>''kshop_master'' THEN RAISE EXCEPTION ''This checkout requires Stripe payment''; END IF;');
 EXECUTE definition;
 -- Return the frozen rail and existing transaction ID to the owner, never credentials.
 definition:=pg_get_functiondef('specials_private.customer_state(uuid,boolean)'::regprocedure);
 definition:=replace(definition,'''checkout'',to_jsonb(c),','''payment'',(SELECT jsonb_build_object(''id'',id,''mode'',payment_mode) FROM public.payment_transactions WHERE order_id=c.order_id),''checkout'',to_jsonb(c),');
 EXECUTE definition;
 -- The regular minimum trigger must not select the Specials rail globally.
 IF to_regprocedure('public.enforce_online_payment_provider_minimum_v1()') IS NOT NULL THEN
  definition:=pg_get_functiondef('public.enforce_online_payment_provider_minimum_v1()'::regprocedure);
  EXECUTE regexp_replace(definition,E'\\mBEGIN\\M[[:space:]]*\n',E'BEGIN\n IF NEW.order_type=''specials'' THEN RETURN NEW; END IF;\n','i');
 END IF;
END $patch$;
CREATE OR REPLACE FUNCTION specials_private.pin_payment_mode() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mode text;
BEGIN
 IF EXISTS(SELECT 1 FROM public.orders WHERE id=NEW.order_id AND order_type='specials') THEN
  SELECT payment_mode INTO mode FROM public.specials_checkouts WHERE order_id=NEW.order_id;
  IF mode IS NULL THEN RAISE EXCEPTION 'Specials checkout snapshot missing'; END IF;
  NEW.payment_mode:=mode; NEW.provider:=CASE WHEN mode='stripe_promptpay' THEN 'stripe' ELSE 'easyslip' END; NEW.rail:='promptpay';
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.specials_finish_stripe_v1(p_order uuid,p_intent text,p_amount_satang integer,p_paid_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; b public.specials_batches%ROWTYPE; o public.orders%ROWTYPE; t public.payment_transactions%ROWTYPE; r specials_private.receipts%ROWTYPE; l record; good boolean; ref text:='stripe:'||p_intent;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order;
 IF NOT FOUND OR c.payment_mode<>'stripe_promptpay' THEN RAISE EXCEPTION 'Not a Stripe Specials checkout'; END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=c.batch_id FOR UPDATE;
 PERFORM specials_private.reap_batch(b.id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
 SELECT * INTO t FROM public.payment_transactions WHERE order_id=p_order FOR UPDATE;
 IF t.provider<>'stripe' OR t.provider_transaction_ref IS DISTINCT FROM p_intent OR p_amount_satang IS DISTINCT FROM round(o.total_amount*100)::integer OR p_paid_at IS NULL THEN RAISE EXCEPTION 'Stripe payment evidence mismatch'; END IF;
 SELECT * INTO r FROM specials_private.receipts WHERE provider_ref=ref;
 IF FOUND AND r.order_id IS DISTINCT FROM p_order THEN RAISE EXCEPTION 'Stripe receipt belongs to another order'; END IF;
 IF FOUND THEN RETURN jsonb_build_object('state',CASE WHEN r.disposition='credited' THEN 'verified' WHEN r.disposition='refunded' THEN 'refunded' ELSE 'refund_required' END); END IF;
 good:=c.inventory_state='held' AND clock_timestamp()<c.payment_deadline AND p_paid_at>=date_trunc('second',c.created_at) AND p_paid_at<=c.payment_deadline AND b.status<>'cancelled';
 INSERT INTO specials_private.receipts(provider_ref,order_id,amount,received_at,disposition) VALUES(ref,p_order,o.total_amount,p_paid_at,CASE WHEN good THEN 'credited' ELSE 'refund_pending' END);
 IF NOT good THEN
  PERFORM specials_private.release_hold(p_order,'expired');
  UPDATE public.specials_checkouts SET financial_state='refund_pending',updated_at=clock_timestamp() WHERE order_id=p_order;
  RETURN jsonb_build_object('state','refund_required');
 END IF;
 FOR l IN SELECT * FROM specials_private.hold_lines WHERE order_id=p_order ORDER BY item_id LOOP
  UPDATE public.specials_items SET quantity_held=quantity_held-l.quantity,quantity_committed=quantity_committed+l.quantity,version=version+1,updated_at=clock_timestamp() WHERE id=l.item_id;
 END LOOP;
 UPDATE public.specials_checkouts SET inventory_state='committed',financial_state='verified',fulfillment_state='ready',updated_at=clock_timestamp() WHERE order_id=p_order;
 UPDATE public.orders SET payment_status='paid',payment_method='promptpay_online',amount_paid=total_amount,status='confirmed',loyalty_points_earned=0,loyalty_multiplier=0,updated_at=clock_timestamp() WHERE id=p_order;
 UPDATE public.payment_transactions SET status='verified',verified_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=t.id;
 INSERT INTO public.order_notification_events(order_id,notification_type,status) VALUES(p_order,'payment_confirmation','pending'),(p_order,'admin_new_order','pending') ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('state','verified');
END $$;
REVOKE ALL ON FUNCTION public.specials_finish_stripe_v1(uuid,text,integer,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.specials_finish_stripe_v1(uuid,text,integer,timestamptz) TO service_role;

CREATE FUNCTION public.specials_stripe_refund_v1(p_order uuid,p_intent text,p_refund text,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE receipt specials_private.receipts%ROWTYPE;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF p_refund IS NULL OR p_refund !~ '^re_' OR p_status NOT IN ('pending','succeeded','failed','canceled','requires_action') THEN RAISE EXCEPTION 'Invalid refund evidence'; END IF;
 -- This handler owns refunds for released holds only; ordinary Admin refunds use their own workflow.
 SELECT * INTO receipt FROM specials_private.receipts WHERE order_id=p_order AND provider_ref='stripe:'||p_intent FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Refund receipt not found'; END IF;
 IF receipt.disposition IN ('refunded','credited') THEN RETURN; END IF;
 UPDATE specials_private.receipts SET refund_reference=p_refund,refund_reason='Stripe payment after stock hold release',disposition=CASE WHEN p_status='succeeded' THEN 'refunded' ELSE 'refund_pending' END,refunded_amount=CASE WHEN p_status='succeeded' THEN amount ELSE 0 END WHERE order_id=p_order AND provider_ref='stripe:'||p_intent AND disposition IN ('refund_pending','refunded');
 IF NOT FOUND THEN RAISE EXCEPTION 'Refund receipt not found'; END IF;
 UPDATE public.specials_checkouts SET financial_state=CASE WHEN p_status='succeeded' THEN 'refunded' ELSE 'refund_pending' END,updated_at=clock_timestamp() WHERE order_id=p_order AND inventory_state='released';
END $$;
REVOKE ALL ON FUNCTION public.specials_stripe_refund_v1(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.specials_stripe_refund_v1(uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_specials_action_v1(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.admin_action(p_action,p_request,p_operation_key) $$;
