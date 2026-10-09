-- Restore Specials guards after regular payment timeout/reactivation replaces expiry.
BEGIN;
DO $guards$
DECLARE signature text; definition text; injection text;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.expire_payment_transaction_v1(uuid)','public.reactivate_expired_online_order_v1(uuid)','public.expire_own_payment_transaction_v1(uuid)'] LOOP
  definition:=pg_get_functiondef(signature::regprocedure);
  IF position(E'BEGIN\n' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected RPC body: %',signature; END IF;
  IF signature='public.expire_payment_transaction_v1(uuid)' THEN
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.specials_checkouts c JOIN public.payment_transactions t ON t.order_id=c.order_id WHERE t.id=p_payment_transaction_id) THEN PERFORM specials_private.reap_batch((SELECT c.batch_id FROM public.specials_checkouts c JOIN public.payment_transactions t ON t.order_id=c.order_id WHERE t.id=p_payment_transaction_id)); RETURN jsonb_build_object(''state'',''specials_swept''); END IF;\n';
  ELSIF signature='public.reactivate_expired_online_order_v1(uuid)' THEN
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''specials'') THEN RAISE EXCEPTION ''Use the authorized Specials workflow''; END IF;\n';
  ELSE
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders o JOIN public.payment_transactions t ON t.order_id=o.id WHERE t.id=p_payment_transaction_id AND o.order_type=''specials'') THEN RAISE EXCEPTION ''Use the authorized Specials workflow''; END IF;\n';
  END IF;
  EXECUTE regexp_replace(definition,E'BEGIN\n',injection);
 END LOOP;
END $guards$;

-- Even privileged legacy handlers cannot issue a regular payment handoff for Specials.
CREATE FUNCTION specials_private.guard_payment_handoff() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.orders WHERE id=NEW.order_id AND order_type='specials')
 OR EXISTS(SELECT 1 FROM public.payment_transactions t JOIN public.orders o ON o.id=t.order_id WHERE t.id=NEW.payment_transaction_id AND o.order_type='specials') THEN
  RAISE EXCEPTION 'Use Specials payment verification';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION specials_private.guard_payment_handoff() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER specials_payment_handoff_guard BEFORE INSERT OR UPDATE ON public.payment_handoff_sessions
FOR EACH ROW EXECUTE FUNCTION specials_private.guard_payment_handoff();
-- Regular checkout's Stripe selector must never change the Specials payment rail.
CREATE FUNCTION specials_private.pin_payment_mode() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.orders WHERE id=NEW.order_id AND order_type='specials') THEN
  NEW.payment_mode:='kshop_master';
  NEW.provider:='easyslip';
  NEW.rail:='promptpay';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION specials_private.pin_payment_mode() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_specials_payment_mode BEFORE INSERT ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION specials_private.pin_payment_mode();
COMMIT;
