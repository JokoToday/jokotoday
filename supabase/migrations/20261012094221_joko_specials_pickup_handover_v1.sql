-- Shared receipt QR infrastructure, with Specials eligibility enforced at both ends.
ALTER TABLE public.pickup_handover_sessions ADD COLUMN pickup_location_id uuid REFERENCES public.cms_pickup_locations(id);

CREATE FUNCTION specials_private.handover_eligible(p_order uuid,p_location uuid,p_staff uuid)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; b public.specials_batches%ROWTYPE; o public.orders%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles u WHERE u.id=p_staff AND
   (u.role::text='admin' OR (u.role::text='staff' AND EXISTS(SELECT 1 FROM specials_private.staff_locations s WHERE s.user_id=u.id AND s.location_id=p_location)))) THEN
   RAISE EXCEPTION 'Not authorized for this pickup location' USING ERRCODE='42501';
 END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order;
 IF NOT FOUND THEN RAISE EXCEPTION 'Specials checkout not found'; END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=c.batch_id FOR UPDATE;
 PERFORM specials_private.reap_batch(b.id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
 IF o.order_type<>'specials' OR o.pickup_location_id IS DISTINCT FROM p_location THEN RAISE EXCEPTION 'Wrong Specials pickup location'; END IF;
 IF c.inventory_state<>'committed' OR c.financial_state<>'verified' OR c.fulfillment_state<>'ready'
    OR o.status<>'confirmed' OR o.payment_status<>'paid' OR o.amount_paid IS DISTINCT FROM o.total_amount THEN
    RAISE EXCEPTION 'Payment is not complete or order is not eligible';
 END IF;
 IF clock_timestamp()<(o.specials_pickup_snapshot->>'start_at')::timestamptz
    OR clock_timestamp()>=(o.specials_pickup_snapshot->>'end_at')::timestamptz
    OR b.business_date<>(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date THEN
    RAISE EXCEPTION 'Outside same-day pickup window';
 END IF;
 RETURN o;
END $$;
REVOKE ALL ON FUNCTION specials_private.handover_eligible(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.create_specials_pickup_handover_v1(p_order uuid,p_location uuid,p_staff uuid,p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE; h public.pickup_handover_sessions%ROWTYPE;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid token hash'; END IF;
 o:=specials_private.handover_eligible(p_order,p_location,p_staff);
 UPDATE public.pickup_handover_sessions SET status='cancelled',updated_at=clock_timestamp() WHERE order_id=p_order AND status='active';
 INSERT INTO public.pickup_handover_sessions(order_id,customer_id,staff_id,token_hash,expires_at,pickup_location_id)
 VALUES(p_order,o.customer_id,p_staff,p_token_hash,least(clock_timestamp()+interval '15 minutes',(o.specials_pickup_snapshot->>'end_at')::timestamptz),p_location)
 RETURNING * INTO h;
 RETURN jsonb_build_object('state','active','handoffId',h.id,'expiresAt',h.expires_at,'orderNumber',o.order_number);
END $$;
REVOKE ALL ON FUNCTION public.create_specials_pickup_handover_v1(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_specials_pickup_handover_v1(uuid,uuid,uuid,text) TO service_role;

ALTER FUNCTION public.finalize_pickup_handover_v1(uuid,text) RENAME TO finalize_regular_pickup_handover_v1;
DO $guard$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('public.finalize_regular_pickup_handover_v1(uuid,text)'::regprocedure);
 IF strpos(definition,'IF p_handoff_id IS NULL THEN')=0 THEN RAISE EXCEPTION 'Unexpected regular handover function'; END IF;
 definition:=replace(definition,'IF p_handoff_id IS NULL THEN',
  'IF EXISTS(SELECT 1 FROM public.pickup_handover_sessions h JOIN public.orders o ON o.id=h.order_id WHERE h.id=p_handoff_id AND o.order_type=''specials'') THEN RAISE EXCEPTION ''Use the Specials handover workflow''; END IF; IF p_handoff_id IS NULL THEN');
 EXECUTE definition;
END $guard$;
CREATE FUNCTION public.finalize_pickup_handover_v1(p_handoff_id uuid,p_bypass_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h public.pickup_handover_sessions%ROWTYPE; o public.orders%ROWTYPE;
 reason text:=nullif(btrim(coalesce(p_bypass_reason,'')),'');
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 SELECT * INTO h FROM public.pickup_handover_sessions WHERE id=p_handoff_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pickup handover not found'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=h.order_id;
 IF o.order_type<>'specials' THEN RETURN public.finalize_regular_pickup_handover_v1(p_handoff_id,p_bypass_reason); END IF;
 PERFORM 1 FROM public.specials_batches b JOIN public.specials_checkouts c ON c.batch_id=b.id WHERE c.order_id=h.order_id FOR UPDATE OF b;
 SELECT * INTO h FROM public.pickup_handover_sessions WHERE id=p_handoff_id FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=h.order_id;
 IF h.status IN ('confirmed','bypassed') THEN RETURN jsonb_build_object('handover',to_jsonb(h),'order',to_jsonb(o),'idempotent_replay',true); END IF;
 IF h.status<>'active' OR clock_timestamp()>=h.expires_at THEN RAISE EXCEPTION 'Pickup handover is inactive or expired'; END IF;
 IF reason IS NOT NULL AND length(reason) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'A short bypass reason is required'; END IF;
 o:=specials_private.handover_eligible(h.order_id,h.pickup_location_id,h.staff_id);
 IF o.customer_id IS DISTINCT FROM h.customer_id THEN RAISE EXCEPTION 'Order customer changed'; END IF;
 UPDATE public.specials_checkouts SET fulfillment_state='picked_up',updated_at=clock_timestamp() WHERE order_id=o.id;
 UPDATE public.orders SET status='picked_up',picked_up_at=clock_timestamp(),staff_id=h.staff_id,loyalty_points_earned=0,updated_at=clock_timestamp() WHERE id=o.id RETURNING * INTO o;
 UPDATE public.pickup_handover_sessions SET status=CASE WHEN reason IS NULL THEN 'confirmed' ELSE 'bypassed' END,
  customer_confirmed_at=CASE WHEN reason IS NULL THEN clock_timestamp() ELSE NULL END,completed_at=clock_timestamp(),bypass_reason=reason,updated_at=clock_timestamp()
 WHERE id=h.id RETURNING * INTO h;
 RETURN jsonb_build_object('handover',to_jsonb(h),'order',to_jsonb(o),'idempotent_replay',false);
END $$;
REVOKE ALL ON FUNCTION public.finalize_pickup_handover_v1(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_pickup_handover_v1(uuid,text) TO service_role;
-- Close the legacy staff-only shortcut; explicit audited fallback uses the shared QR session.
CREATE OR REPLACE FUNCTION specials_private.pickup(p_order uuid,p_location uuid) RETURNS SETOF public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Use the pickup handover and customer receipt confirmation workflow'; END $$;
