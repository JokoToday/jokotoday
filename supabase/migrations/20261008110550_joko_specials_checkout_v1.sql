BEGIN;
-- JOKO Specials: existing orders/payment rail, isolated stock, immutable checkout snapshots.
-- Apply only after the inventory foundation and payment rail migrations.
ALTER TABLE public.specials_batches DROP CONSTRAINT specials_batches_status_check;
ALTER TABLE public.specials_batches ADD CONSTRAINT specials_batches_status_check CHECK(status IN ('draft','prepared','live','closed','cancelled'));
DROP INDEX public.specials_one_prepared_batch;
CREATE UNIQUE INDEX specials_one_active_batch ON public.specials_batches((true)) WHERE status IN ('prepared','live');
ALTER TABLE public.orders ADD COLUMN order_type text NOT NULL DEFAULT 'regular' CHECK(order_type IN ('regular','specials'));
ALTER TABLE public.orders ADD COLUMN specials_batch_id uuid REFERENCES public.specials_batches(id) ON DELETE RESTRICT;
ALTER TABLE public.orders ADD COLUMN specials_pickup_snapshot jsonb;
ALTER TABLE public.orders ADD CONSTRAINT specials_order_link CHECK((order_type='specials')=(specials_batch_id IS NOT NULL) AND (order_type<>'specials' OR (specials_pickup_snapshot IS NOT NULL AND pickup_date_id IS NULL AND NOT inventory_reserved)));
CREATE INDEX specials_orders_batch_idx ON public.orders(specials_batch_id) WHERE order_type='specials';
CREATE TABLE specials_private.settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false,
 qr_payload text NOT NULL DEFAULT '', receiver_bank_code text NOT NULL DEFAULT '', receiver_bank_number text NOT NULL DEFAULT '', receiver_label text NOT NULL DEFAULT '',
 updated_by uuid REFERENCES auth.users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO specials_private.settings(id) VALUES(true);
CREATE TABLE public.specials_checkouts (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
 batch_id uuid NOT NULL REFERENCES public.specials_batches(id), customer_id uuid NOT NULL REFERENCES auth.users(id),
 operation_key uuid NOT NULL UNIQUE, request jsonb NOT NULL,
 inventory_state text NOT NULL CHECK(inventory_state IN ('held','verifying','committed','released')),
 financial_state text NOT NULL DEFAULT 'pending' CHECK(financial_state IN ('pending','verifying','verified','reconciliation_required','refund_pending','refunded')),
 fulfillment_state text NOT NULL DEFAULT 'awaiting_payment' CHECK(fulfillment_state IN ('awaiting_payment','ready','picked_up','no_show','cancelled')),
 payment_deadline timestamptz NOT NULL, verification_deadline timestamptz NOT NULL,
 active_attempt_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX specials_one_customer_hold ON public.specials_checkouts(customer_id,batch_id) WHERE inventory_state IN ('held','verifying');
CREATE INDEX specials_checkouts_expiry ON public.specials_checkouts(batch_id,payment_deadline) WHERE inventory_state IN ('held','verifying');
CREATE TABLE specials_private.checkout_snapshots (
 order_id uuid PRIMARY KEY REFERENCES public.specials_checkouts(order_id), settings jsonb NOT NULL
);
CREATE TABLE specials_private.hold_lines (
 order_id uuid REFERENCES public.specials_checkouts(order_id), item_id uuid REFERENCES public.specials_items(id), quantity integer NOT NULL CHECK(quantity>0), PRIMARY KEY(order_id,item_id)
);
CREATE TABLE specials_private.attempts (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES public.specials_checkouts(order_id), storage_path text NOT NULL,
 registered_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz, evidence jsonb,
 result jsonb
);
CREATE TABLE specials_private.receipts (
 provider_ref text PRIMARY KEY, order_id uuid NOT NULL REFERENCES public.specials_checkouts(order_id),
 amount numeric(10,2) NOT NULL CHECK(amount>0), received_at timestamptz NOT NULL,
 disposition text NOT NULL CHECK(disposition IN ('credited','reconciliation_required','refund_pending','refunded')),
 refunded_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK(refunded_amount>=0 AND refunded_amount<=amount), refund_reference text, refund_reason text, refunded_by uuid REFERENCES auth.users(id)
);
CREATE TABLE public.specials_line_outbox (
 batch_id uuid PRIMARY KEY REFERENCES public.specials_batches(id), retry_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 message text NOT NULL, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','accepted','failed','uncertain','suppressed')),
 first_attempt_at timestamptz, lease_until timestamptz, attempt_count integer NOT NULL DEFAULT 0, accepted_request_id text, last_error text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE specials_private.staff_locations (
 user_id uuid REFERENCES auth.users(id), location_id uuid REFERENCES public.cms_pickup_locations(id), PRIMARY KEY(user_id,location_id)
);
ALTER TABLE public.specials_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specials_line_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.specials_checkouts,public.specials_line_outbox FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.specials_checkouts,public.specials_line_outbox TO authenticated,service_role;
CREATE POLICY specials_checkout_read ON public.specials_checkouts FOR SELECT TO authenticated USING(customer_id=auth.uid() OR specials_private.is_admin() OR EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role::text='staff'));
CREATE POLICY specials_line_admin_read ON public.specials_line_outbox FOR SELECT TO authenticated USING(specials_private.is_admin());
REVOKE ALL ON ALL TABLES IN SCHEMA specials_private FROM PUBLIC,anon,authenticated,service_role;

-- One batch lock serializes every stock/payment lifecycle mutation. Network calls never hold it.
CREATE FUNCTION specials_private.release_hold(p_order uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; l record;
BEGIN
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 IF c.inventory_state NOT IN ('held','verifying') THEN RETURN; END IF;
 FOR l IN SELECT * FROM specials_private.hold_lines WHERE order_id=p_order ORDER BY item_id LOOP
  UPDATE public.specials_items SET quantity_held=quantity_held-l.quantity,quantity_available=quantity_available+l.quantity,version=version+1,updated_at=clock_timestamp() WHERE id=l.item_id;
 END LOOP;
 UPDATE public.specials_checkouts SET inventory_state='released',financial_state=CASE WHEN financial_state IN ('pending','verifying') THEN 'pending' ELSE financial_state END,fulfillment_state='cancelled',updated_at=clock_timestamp() WHERE order_id=p_order;
 UPDATE public.orders SET status='cancelled',inventory_reserved=false WHERE id=p_order AND payment_status='unpaid';
 UPDATE public.payment_transactions SET status=CASE WHEN p_reason='cancelled' THEN 'cancelled' ELSE 'expired' END,last_error_code=p_reason,updated_at=clock_timestamp() WHERE order_id=p_order AND status<>'verified';
END $$;
CREATE FUNCTION specials_private.reap_batch(p_batch uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c record; b public.specials_batches%ROWTYPE; t timestamptz;
BEGIN
 SELECT * INTO b FROM public.specials_batches WHERE id=p_batch FOR UPDATE;
 t:=clock_timestamp();
 FOR c IN SELECT * FROM public.specials_checkouts WHERE batch_id=p_batch AND inventory_state IN ('held','verifying') ORDER BY order_id FOR UPDATE LOOP
  IF (c.inventory_state='held' AND t>=c.payment_deadline) OR (c.inventory_state='verifying' AND t>=c.verification_deadline) THEN PERFORM specials_private.release_hold(c.order_id,'expired'); END IF;
 END LOOP;
 IF b.status IN ('prepared','live') AND t>=b.sales_end_at THEN UPDATE public.specials_batches SET status='closed',closed_at=t,version=version+1 WHERE id=p_batch; END IF;
 IF t>=b.pickup_end_at THEN UPDATE public.specials_checkouts SET fulfillment_state='no_show',updated_at=t WHERE batch_id=p_batch AND inventory_state='committed' AND fulfillment_state='ready'; END IF;
 UPDATE public.specials_line_outbox SET status='suppressed',last_error='Sale no longer eligible',updated_at=t WHERE batch_id=p_batch AND status IN ('queued','failed') AND (b.status<>'live' OR t>=b.sales_end_at-interval '5 minutes');
END $$;
CREATE FUNCTION specials_private.checkout(p_batch uuid,p_cart jsonb,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.specials_batches%ROWTYPE; u public.user_profiles%ROWTYPE; s specials_private.settings%ROWTYPE; c public.specials_checkouts%ROWTYPE; i public.specials_items%ROWTYPE; row record; pr public.cms_products%ROWTYPE; loc public.cms_pickup_locations%ROWTYPE; oid uuid:=gen_random_uuid(); total integer:=0; items jsonb:='[]'; t timestamptz; used integer;
BEGIN
 IF auth.uid() IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'Sign in and provide an operation key'; END IF;
 IF p_cart IS NULL OR jsonb_typeof(p_cart)<>'array' OR jsonb_array_length(p_cart)=0 OR jsonb_array_length(p_cart)>50 THEN RAISE EXCEPTION 'Invalid cart'; END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=p_batch FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Specials unavailable'; END IF;
 PERFORM specials_private.reap_batch(p_batch);
 SELECT * INTO c FROM public.specials_checkouts WHERE operation_key=p_key;
 IF FOUND THEN
  IF c.customer_id<>auth.uid() OR c.batch_id<>p_batch OR c.request<>p_cart THEN RAISE EXCEPTION 'Operation key belongs to a different request'; END IF;
  RETURN jsonb_build_object('order_id',c.order_id);
 END IF;
 t:=clock_timestamp();
 SELECT * INTO s FROM specials_private.settings WHERE id;
 IF NOT s.enabled OR b.status<>'live' OR t<b.sales_start_at OR t>=b.sales_end_at-interval '5 minutes' OR b.business_date<>(t AT TIME ZONE 'Asia/Bangkok')::date THEN RAISE EXCEPTION 'Checkout is closed'; END IF;
 SELECT * INTO u FROM public.user_profiles WHERE id=auth.uid();
 IF NOT FOUND OR NOT coalesce(u.profile_completed,false) OR nullif(trim(u.name),'') IS NULL OR nullif(trim(u.phone),'') IS NULL THEN RAISE EXCEPTION 'Complete your name and phone in your profile first'; END IF;
 IF EXISTS(SELECT 1 FROM public.specials_checkouts WHERE customer_id=auth.uid() AND batch_id=p_batch AND inventory_state IN ('held','verifying')) THEN RAISE EXCEPTION 'Resume or cancel your existing checkout first'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_cart) x GROUP BY x->>'item_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate cart item'; END IF;
 SELECT * INTO loc FROM public.cms_pickup_locations WHERE id=b.pickup_location_id AND is_active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pickup location unavailable'; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(p_cart) ORDER BY value->>'item_id' LOOP
  IF coalesce(row.value->>'quantity','') !~ '^[1-9][0-9]{0,3}$' THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT * INTO i FROM public.specials_items WHERE id=(row.value->>'item_id')::uuid AND batch_id=p_batch FOR UPDATE;
  IF NOT FOUND OR NOT i.is_enabled OR i.quantity_available<(row.value->>'quantity')::int THEN RAISE EXCEPTION 'Specials item sold out'; END IF;
  SELECT * INTO pr FROM public.cms_products WHERE id=i.product_id AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  SELECT coalesce(sum(h.quantity),0) INTO used FROM specials_private.hold_lines h JOIN public.specials_checkouts x ON x.order_id=h.order_id WHERE h.item_id=i.id AND x.customer_id=auth.uid() AND x.inventory_state IN ('held','verifying','committed');
  IF i.max_per_customer IS NOT NULL AND used+(row.value->>'quantity')::int>i.max_per_customer THEN RAISE EXCEPTION 'Customer quantity limit exceeded'; END IF;
  total:=total+i.special_price_satang*(row.value->>'quantity')::int;
  items:=items||jsonb_build_array(jsonb_build_object('product_id',pr.id,'product_name',pr.name_en,'product_name_th',pr.name_th,'product_name_zh',pr.name_zh,'quantity',(row.value->>'quantity')::int,'price_at_order',i.special_price_satang/100.0));
 END LOOP;
 t:=clock_timestamp();
 IF t>=b.sales_end_at-interval '5 minutes' OR b.business_date<>(t AT TIME ZONE 'Asia/Bangkok')::date THEN RAISE EXCEPTION 'Checkout is closed'; END IF;
 INSERT INTO public.orders(id,customer_id,order_number,order_items,total_amount,pickup_location_id,pickup_date,status,payment_status,customer_name,customer_phone,customer_email,line_id,purchase_type,order_type,specials_batch_id,specials_pickup_snapshot,inventory_reserved,loyalty_points_earned,loyalty_multiplier)
 VALUES(oid,auth.uid(),'JT-'||nextval('public.online_order_number_seq'),items,total/100.0,b.pickup_location_id,b.business_date,'pending','unpaid',u.name,u.phone,u.email,u.line_id,'online','specials',b.id,jsonb_build_object('name_en',loc.name_en,'name_th',loc.name_th,'name_zh',loc.name_zh,'maps_url',loc.maps_url,'start_at',b.pickup_start_at,'end_at',b.pickup_end_at),false,0,0);
 INSERT INTO public.specials_checkouts(order_id,batch_id,customer_id,operation_key,request,inventory_state,payment_deadline,verification_deadline) VALUES(oid,b.id,auth.uid(),p_key,p_cart,'held',t+interval '5 minutes',t+interval '7 minutes');
 INSERT INTO specials_private.checkout_snapshots VALUES(oid,to_jsonb(s));
 INSERT INTO public.payment_transactions(order_id,customer_id,amount_due,status,expires_at) VALUES(oid,auth.uid(),total/100.0,'pending',t+interval '5 minutes');
 FOR row IN SELECT value FROM jsonb_array_elements(p_cart) LOOP
  INSERT INTO specials_private.hold_lines VALUES(oid,(row.value->>'item_id')::uuid,(row.value->>'quantity')::int);
  UPDATE public.specials_items SET quantity_available=quantity_available-(row.value->>'quantity')::int,quantity_held=quantity_held+(row.value->>'quantity')::int,version=version+1,updated_at=t WHERE id=(row.value->>'item_id')::uuid;
 END LOOP;
 RETURN jsonb_build_object('order_id',oid);
END $$;
CREATE FUNCTION specials_private.customer_state(p_order uuid,p_cancel boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; o public.orders%ROWTYPE; snap jsonb;
BEGIN
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order AND customer_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Checkout not found'; END IF;
 PERFORM specials_private.reap_batch(c.batch_id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 IF p_cancel THEN
  IF c.inventory_state='verifying' THEN RAISE EXCEPTION 'Verification in progress; wait for the result'; END IF;
  IF c.inventory_state='committed' THEN RAISE EXCEPTION 'Paid orders require Admin assistance'; END IF;
  PERFORM specials_private.release_hold(p_order,'cancelled');
  SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order;
 END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order;
 SELECT settings INTO snap FROM specials_private.checkout_snapshots WHERE order_id=p_order;
 RETURN jsonb_build_object('checkout',to_jsonb(c),'order',jsonb_build_object('id',o.id,'order_number',o.order_number,'order_items',o.order_items,'total_amount',o.total_amount,'payment_status',o.payment_status,'status',o.status,'pickup',o.specials_pickup_snapshot),'qr_payload',CASE WHEN c.inventory_state='held' THEN snap->>'qr_payload' ELSE NULL END,'receiver_label',snap->>'receiver_label','server_now',clock_timestamp());
END $$;
-- Register only after a full image upload, before the provider call. Service role only.
CREATE FUNCTION specials_private.begin_verification(p_order uuid,p_customer uuid,p_attempt uuid,p_path text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; snap jsonb; o public.orders%ROWTYPE; a specials_private.attempts%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order AND customer_id=p_customer;
 IF NOT FOUND THEN RAISE EXCEPTION 'Checkout not found'; END IF;
 PERFORM specials_private.reap_batch(c.batch_id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO a FROM specials_private.attempts WHERE id=p_attempt;
 IF FOUND THEN RAISE EXCEPTION 'Upload was already submitted; refresh checkout status'; END IF;
 IF (SELECT count(*) FROM specials_private.attempts WHERE order_id=p_order)>=6 THEN RAISE EXCEPTION 'Slip submission limit reached; contact Admin'; END IF;
 IF c.inventory_state NOT IN ('held','released') OR (c.inventory_state='held' AND clock_timestamp()>=c.payment_deadline) THEN RAISE EXCEPTION 'Cannot submit another slip during verification or after payment'; END IF;
 IF c.inventory_state='held' THEN
  UPDATE public.specials_checkouts SET inventory_state='verifying',financial_state='verifying',active_attempt_id=p_attempt,updated_at=clock_timestamp() WHERE order_id=p_order;
  UPDATE public.payment_transactions SET status='verifying',updated_at=clock_timestamp() WHERE order_id=p_order;
 END IF;
 INSERT INTO specials_private.attempts(id,order_id,storage_path) VALUES(p_attempt,p_order,p_path);
 SELECT settings INTO snap FROM specials_private.checkout_snapshots WHERE order_id=p_order;
 SELECT * INTO o FROM public.orders WHERE id=p_order;
 RETURN jsonb_build_object('amount',o.total_amount,'order_number',o.order_number,'receiver_bank_code',snap->>'receiver_bank_code','receiver_bank_number',snap->>'receiver_bank_number');
END $$;
CREATE FUNCTION specials_private.finish_verification(p_attempt uuid,p_evidence jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a specials_private.attempts%ROWTYPE; c public.specials_checkouts%ROWTYPE; o public.orders%ROWTYPE; b public.specials_batches%ROWTYPE; r specials_private.receipts%ROWTYPE; snap jsonb; l record; ref text; amount numeric; paid_at timestamptz; good boolean; v_result jsonb;
BEGIN
 SELECT * INTO a FROM specials_private.attempts WHERE id=p_attempt;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=a.order_id;
 SELECT * INTO b FROM public.specials_batches WHERE id=c.batch_id FOR UPDATE;
 PERFORM specials_private.reap_batch(c.batch_id);
 SELECT * INTO a FROM specials_private.attempts WHERE id=p_attempt FOR UPDATE;
 IF a.result IS NOT NULL THEN RETURN a.result; END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=a.order_id FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=c.order_id FOR UPDATE;
 SELECT settings INTO snap FROM specials_private.checkout_snapshots WHERE order_id=c.order_id;
 ref:=nullif(trim(p_evidence->>'reference'),''); amount:=(p_evidence->>'amount')::numeric; paid_at:=(p_evidence->>'paid_at')::timestamptz;
 IF coalesce((p_evidence->>'provider_success')::boolean,false) AND ref IS NOT NULL AND amount>0 AND paid_at IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('easyslip:'||ref,811));
  SELECT * INTO r FROM specials_private.receipts WHERE provider_ref=ref;
  IF FOUND OR EXISTS(SELECT 1 FROM public.payment_transactions WHERE provider='easyslip' AND provider_transaction_ref=ref) THEN
   v_result:=jsonb_build_object('state','duplicate','message','This transfer has already been recorded. Contact Admin if needed.');
  ELSE
   good:=coalesce(coalesce((p_evidence->>'account_matched')::boolean,false) AND p_evidence->>'bank_code'=snap->>'receiver_bank_code' AND regexp_replace(coalesce(p_evidence->>'bank_number',''),'[^0-9]','','g')=regexp_replace(snap->>'receiver_bank_number','[^0-9]','','g'),false);
   -- Wrong recipients are evidence only; they are not JOKO money or refundable receipts.
   IF NOT good THEN v_result:=jsonb_build_object('state','rejected','message','Receiver does not match JOKO. Contact Admin before paying again.');
   ELSE
    good:=amount=o.total_amount AND NOT coalesce((p_evidence->>'duplicate')::boolean,true) AND c.inventory_state='verifying' AND c.active_attempt_id=p_attempt AND a.registered_at<c.payment_deadline AND clock_timestamp()<c.verification_deadline AND paid_at>=c.created_at AND paid_at<=c.payment_deadline AND b.status<>'cancelled';
    INSERT INTO specials_private.receipts(provider_ref,order_id,amount,received_at,disposition) VALUES(ref,c.order_id,amount,paid_at,CASE WHEN good THEN 'credited' ELSE 'reconciliation_required' END);
    IF good THEN
     FOR l IN SELECT * FROM specials_private.hold_lines WHERE order_id=c.order_id ORDER BY item_id LOOP
      UPDATE public.specials_items SET quantity_held=quantity_held-l.quantity,quantity_committed=quantity_committed+l.quantity,version=version+1,updated_at=clock_timestamp() WHERE id=l.item_id;
     END LOOP;
     UPDATE public.specials_checkouts SET inventory_state='committed',financial_state='verified',fulfillment_state='ready',updated_at=clock_timestamp() WHERE order_id=c.order_id;
     UPDATE public.orders SET payment_status='paid',payment_method='promptpay_online',amount_paid=total_amount,status='confirmed',loyalty_points_earned=0,loyalty_multiplier=0 WHERE id=c.order_id;
     UPDATE public.payment_transactions SET status='verified',provider_transaction_ref=ref,verified_at=clock_timestamp(),updated_at=clock_timestamp() WHERE order_id=c.order_id;
     INSERT INTO public.order_notification_events(order_id,notification_type,status) VALUES(c.order_id,'payment_confirmation','pending'),(c.order_id,'admin_new_order','pending') ON CONFLICT DO NOTHING;
     v_result:=jsonb_build_object('state','verified');
    ELSE
     PERFORM specials_private.release_hold(c.order_id,'reconciliation_required');
     UPDATE public.specials_checkouts SET financial_state='reconciliation_required',updated_at=clock_timestamp() WHERE order_id=c.order_id;
     v_result:=jsonb_build_object('state','reconciliation_required','message','Payment needs Admin reconciliation. Stock has not been reacquired. Do not pay again.');
    END IF;
   END IF;
  END IF;
 ELSE v_result:=jsonb_build_object('state','provider_error','message','Verification could not confirm this transfer. Refresh or contact Admin.');
 END IF;
 -- A rejected v_result never extends the original deadlines.
 IF c.inventory_state='verifying' AND c.active_attempt_id=p_attempt AND v_result->>'state' IN ('rejected','duplicate','provider_error') THEN
  IF clock_timestamp()<c.payment_deadline THEN
   UPDATE public.specials_checkouts SET inventory_state='held',financial_state='pending',active_attempt_id=NULL,updated_at=clock_timestamp() WHERE order_id=c.order_id;
   UPDATE public.payment_transactions SET status='pending' WHERE order_id=c.order_id;
  ELSE PERFORM specials_private.release_hold(c.order_id,'expired'); END IF;
 END IF;
 UPDATE specials_private.attempts SET evidence=p_evidence,completed_at=clock_timestamp(),result=v_result WHERE id=p_attempt;
 RETURN v_result;
END $$;
CREATE FUNCTION specials_private.pickup(p_order uuid,p_location uuid) RETURNS SETOF public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.specials_checkouts%ROWTYPE; b public.specials_batches%ROWTYPE; o public.orders%ROWTYPE;
BEGIN
 IF NOT specials_private.is_admin() AND NOT EXISTS(SELECT 1 FROM public.user_profiles u JOIN specials_private.staff_locations s ON s.user_id=u.id WHERE u.id=auth.uid() AND u.role::text='staff' AND s.location_id=p_location) THEN RAISE EXCEPTION 'Not authorized for this pickup location'; END IF;
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order;
 IF NOT FOUND THEN RAISE EXCEPTION 'Specials order not found'; END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=c.batch_id FOR UPDATE;
 PERFORM specials_private.reap_batch(b.id);
 SELECT * INTO c FROM public.specials_checkouts WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
 IF o.pickup_location_id IS DISTINCT FROM p_location THEN RAISE EXCEPTION 'Wrong pickup location'; END IF;
 IF c.fulfillment_state='picked_up' THEN RETURN NEXT o; RETURN; END IF;
 IF c.inventory_state<>'committed' OR c.financial_state<>'verified' OR c.fulfillment_state<>'ready' OR o.payment_status<>'paid' OR o.amount_paid<>o.total_amount THEN RAISE EXCEPTION 'Payment is not complete or order is not eligible'; END IF;
 IF clock_timestamp()<(o.specials_pickup_snapshot->>'start_at')::timestamptz OR clock_timestamp()>=(o.specials_pickup_snapshot->>'end_at')::timestamptz OR b.business_date<>(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date THEN RAISE EXCEPTION 'Outside same-day pickup window'; END IF;
 UPDATE public.specials_checkouts SET fulfillment_state='picked_up',updated_at=clock_timestamp() WHERE order_id=p_order;
 UPDATE public.orders SET status='picked_up',picked_up_at=clock_timestamp(),loyalty_points_earned=0 WHERE id=p_order RETURNING * INTO o;
 RETURN NEXT o;
END $$;
CREATE FUNCTION specials_private.catalog() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT jsonb_build_object('batch',jsonb_build_object('id',b.id,'title',b.title,'pickup_start_at',b.pickup_start_at,'pickup_end_at',b.pickup_end_at,'sales_end_at',b.sales_end_at,'location',jsonb_build_object('name_en',l.name_en,'name_th',l.name_th,'maps_url',l.maps_url)), 'items',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name_en',p.name_en,'name_th',p.name_th,'image',p.image,'price_satang',i.special_price_satang,'regular_price_satang',i.regular_price_satang,'available',i.quantity_available,'max_per_customer',i.max_per_customer) ORDER BY i.created_at),'[]'::jsonb) FROM public.specials_items i JOIN public.cms_products p ON p.id=i.product_id WHERE i.batch_id=b.id AND i.is_enabled AND p.is_active)) FROM public.specials_batches b JOIN public.cms_pickup_locations l ON l.id=b.pickup_location_id JOIN specials_private.settings s ON s.id WHERE b.status='live' AND s.enabled AND l.is_active AND clock_timestamp()>=b.sales_start_at AND clock_timestamp()<b.sales_end_at-interval '5 minutes' AND b.business_date=(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date LIMIT 1),'{}'::jsonb);
$$;
-- Extend the existing admin dispatcher while preserving its audited retry contract.
ALTER FUNCTION specials_private.admin_action(text,jsonb,uuid) RENAME TO preparation_action;
DO $patch$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('specials_private.preparation_action(text,jsonb,uuid)'::regprocedure);
 IF position('NOT IN (''draft'',''prepared'')' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected preparation contract'; END IF;
 definition:=replace(definition,'NOT IN (''draft'',''prepared'')','NOT IN (''draft'',''prepared'',''live'')');
 EXECUTE definition;
END $patch$;
CREATE FUNCTION specials_private.admin_action(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.specials_batches%ROWTYPE; s specials_private.settings%ROWTYPE; r specials_private.receipts%ROWTYPE; outbox public.specials_line_outbox%ROWTYPE; t timestamptz; loc public.cms_pickup_locations%ROWTYPE; msg text;
BEGIN
 IF NOT specials_private.is_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF p_action IN ('save_batch','save_item','transfer','prepare','close','cancel') THEN
  IF p_action='cancel' AND EXISTS(SELECT 1 FROM public.specials_checkouts WHERE batch_id=(p_request->>'batch_id')::uuid AND inventory_state='committed' AND financial_state<>'refunded' AND fulfillment_state<>'picked_up') THEN RAISE EXCEPTION 'Resolve paid orders before emergency cancellation'; END IF;
  RETURN specials_private.preparation_action(p_action,p_request,p_operation_key);
 END IF;
 IF p_action='settings' THEN
  IF coalesce((p_request->>'enabled')::boolean,false) AND (length(coalesce(p_request->>'qr_payload','')) NOT BETWEEN 30 AND 2048 OR coalesce(p_request->>'receiver_bank_code','')='' OR length(regexp_replace(coalesce(p_request->>'receiver_bank_number',''),'[^0-9]','','g'))<6 OR coalesce(p_request->>'receiver_label','')='') THEN RAISE EXCEPTION 'Approved merchant QR and exact registered receiver required'; END IF;
  UPDATE specials_private.settings SET enabled=coalesce((p_request->>'enabled')::boolean,false),qr_payload=coalesce(p_request->>'qr_payload',''),receiver_bank_code=upper(trim(coalesce(p_request->>'receiver_bank_code',''))),receiver_bank_number=coalesce(p_request->>'receiver_bank_number',''),receiver_label=coalesce(p_request->>'receiver_label',''),updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id RETURNING * INTO s;
  RETURN jsonb_build_object('settings',to_jsonb(s));
 END IF;
 IF p_action='staff_location' THEN
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=(p_request->>'user_id')::uuid AND role::text='staff') OR NOT EXISTS(SELECT 1 FROM public.cms_pickup_locations WHERE id=(p_request->>'location_id')::uuid AND is_active) THEN RAISE EXCEPTION 'Active location and staff user required'; END IF;
  IF coalesce((p_request->>'enabled')::boolean,false) THEN INSERT INTO specials_private.staff_locations VALUES((p_request->>'user_id')::uuid,(p_request->>'location_id')::uuid) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM specials_private.staff_locations WHERE user_id=(p_request->>'user_id')::uuid AND location_id=(p_request->>'location_id')::uuid; END IF;
  RETURN jsonb_build_object('saved',true);
 END IF;
 SELECT * INTO b FROM public.specials_batches WHERE id=(p_request->>'batch_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Batch not found'; END IF;
 t:=clock_timestamp();
 IF p_action='publish' THEN
  IF b.status='live' THEN RETURN jsonb_build_object('batch',to_jsonb(b)); END IF;
  IF b.version IS DISTINCT FROM (p_request->>'expected_version')::integer THEN RAISE EXCEPTION 'Batch changed; refresh'; END IF;
  IF b.status<>'prepared' OR b.business_date<>(t AT TIME ZONE 'Asia/Bangkok')::date OR t<b.sales_start_at OR t>=b.sales_end_at-interval '5 minutes' OR NOT EXISTS(SELECT 1 FROM specials_private.settings WHERE id AND enabled) OR NOT EXISTS(SELECT 1 FROM public.specials_items i JOIN public.cms_products p ON p.id=i.product_id WHERE i.batch_id=b.id AND i.is_enabled AND i.quantity_available>0 AND p.is_active) OR NOT EXISTS(SELECT 1 FROM public.cms_pickup_locations WHERE id=b.pickup_location_id AND is_active) THEN RAISE EXCEPTION 'Publication requires enabled payment, prepared stock and an open sales window'; END IF;
  UPDATE public.specials_batches SET status='live',version=version+1,updated_at=t WHERE id=b.id RETURNING * INTO b;
  RETURN jsonb_build_object('batch',to_jsonb(b));
 ELSIF p_action='queue_line' THEN
  IF b.status<>'live' OR t>=b.sales_end_at-interval '5 minutes' OR NOT EXISTS(SELECT 1 FROM public.specials_items WHERE batch_id=b.id AND is_enabled AND quantity_available>0) THEN RAISE EXCEPTION 'Sale is not eligible for announcement'; END IF;
  SELECT * INTO loc FROM public.cms_pickup_locations WHERE id=b.pickup_location_id;
  msg:='JOKO Specials — '||b.title||E'\nขนม JOKO ราคาพิเศษ รับวันนี้เท่านั้น / Same-day pickup only\n'||loc.name_en||' / '||loc.name_th||E'\n'||to_char(b.pickup_start_at AT TIME ZONE 'Asia/Bangkok','DD Mon HH24:MI')||'–'||to_char(b.pickup_end_at AT TIME ZONE 'Asia/Bangkok','HH24:MI')||E' (Bangkok)\nLimited stock / มีจำนวนจำกัด\nhttps://joko.today/specials';
  INSERT INTO public.specials_line_outbox(batch_id,message) VALUES(b.id,msg) ON CONFLICT(batch_id) DO NOTHING;
  SELECT * INTO outbox FROM public.specials_line_outbox WHERE batch_id=b.id;
  RETURN jsonb_build_object('batch',to_jsonb(b),'announcement',to_jsonb(outbox));
 ELSIF p_action='refund_pending' THEN
  SELECT * INTO r FROM specials_private.receipts WHERE provider_ref=p_request->>'reference' AND order_id IN (SELECT order_id FROM public.specials_checkouts WHERE batch_id=b.id) FOR UPDATE;
  IF NOT FOUND OR nullif(trim(p_request->>'reason'),'') IS NULL OR r.disposition='refunded' OR EXISTS(SELECT 1 FROM public.specials_checkouts WHERE order_id=r.order_id AND fulfillment_state='picked_up') THEN RAISE EXCEPTION 'Unrefunded receipt, reason and uncollected order required'; END IF;
  UPDATE specials_private.receipts SET disposition='refund_pending',refund_reason=p_request->>'reason' WHERE provider_ref=r.provider_ref;
  UPDATE public.specials_checkouts SET financial_state='refund_pending',fulfillment_state='cancelled',updated_at=t WHERE order_id=r.order_id;
  UPDATE public.orders SET status='cancelled' WHERE id=r.order_id;
  RETURN jsonb_build_object('batch',to_jsonb(b));
 ELSIF p_action='refund' THEN
  SELECT * INTO r FROM specials_private.receipts WHERE provider_ref=p_request->>'reference' AND order_id IN (SELECT order_id FROM public.specials_checkouts WHERE batch_id=b.id) FOR UPDATE;
  IF NOT FOUND OR nullif(trim(p_request->>'reason'),'') IS NULL OR nullif(trim(p_request->>'refund_reference'),'') IS NULL OR (p_request->>'amount')::numeric<>r.amount THEN RAISE EXCEPTION 'Full actual refund amount, bank reference and reason required'; END IF;
  IF r.disposition='refunded' THEN
   IF r.refund_reference<>p_request->>'refund_reference' THEN RAISE EXCEPTION 'Refund already recorded'; END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM public.specials_checkouts WHERE order_id=r.order_id AND fulfillment_state='picked_up') THEN RAISE EXCEPTION 'Picked-up orders need separate financial review'; END IF;
   UPDATE specials_private.receipts SET disposition='refunded',refunded_amount=amount,refund_reference=p_request->>'refund_reference',refund_reason=p_request->>'reason',refunded_by=auth.uid() WHERE provider_ref=r.provider_ref;
   -- Refund does not restock committed goods; Admin handles physical leftovers separately.
   UPDATE public.specials_checkouts SET financial_state=CASE WHEN EXISTS(SELECT 1 FROM specials_private.receipts remaining WHERE remaining.order_id=r.order_id AND remaining.disposition<>'refunded') THEN 'refund_pending' ELSE 'refunded' END,fulfillment_state='cancelled',updated_at=t WHERE order_id=r.order_id;
   UPDATE public.orders SET status='cancelled' WHERE id=r.order_id;
  END IF;
  RETURN jsonb_build_object('batch',to_jsonb(b));
 END IF;
 RAISE EXCEPTION 'Invalid Specials action';
END $$;
-- SQL wrappers resolve functions at execution time; replace to bind renamed dispatcher.
CREATE OR REPLACE FUNCTION public.admin_specials_action_v1(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.admin_action(p_action,p_request,p_operation_key) $$;
CREATE FUNCTION specials_private.admin_details() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT specials_private.is_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
 RETURN jsonb_build_object('settings',(SELECT to_jsonb(s) FROM specials_private.settings s WHERE id),'staff_locations',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM specials_private.staff_locations s),'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('batch_id',c.batch_id)),'[]') FROM specials_private.receipts r JOIN public.specials_checkouts c ON c.order_id=r.order_id));
END $$;
CREATE FUNCTION specials_private.line_action(p_action text,p_batch uuid,p_result jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.specials_batches%ROWTYPE; x public.specials_line_outbox%ROWTYPE; t timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO b FROM public.specials_batches WHERE id=p_batch FOR UPDATE;
 SELECT * INTO x FROM public.specials_line_outbox WHERE batch_id=p_batch FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Announcement not prepared'; END IF;
 IF p_action='claim' THEN
  IF x.status IN ('accepted','suppressed') THEN RETURN jsonb_build_object('send',false,'status',x.status); END IF;
  IF x.status='sending' AND x.lease_until>t THEN RETURN jsonb_build_object('send',false,'status','sending'); END IF;
  IF x.first_attempt_at IS NOT NULL AND t>=x.first_attempt_at+interval '23 hours' THEN
   UPDATE public.specials_line_outbox SET status='uncertain',last_error='Retry window exhausted; do not create another campaign',lease_until=NULL WHERE batch_id=p_batch;
   RETURN jsonb_build_object('send',false,'status','uncertain');
  END IF;
  IF b.status<>'live' OR t>=b.sales_end_at-interval '5 minutes' OR NOT EXISTS(SELECT 1 FROM public.specials_items WHERE batch_id=p_batch AND is_enabled AND quantity_available>0) THEN
   UPDATE public.specials_line_outbox SET status=CASE WHEN first_attempt_at IS NULL THEN 'suppressed' ELSE 'uncertain' END,last_error='Sale closed or sold out; sending suppressed',lease_until=NULL WHERE batch_id=p_batch;
   RETURN jsonb_build_object('send',false,'status','suppressed');
  END IF;
  UPDATE public.specials_line_outbox SET status='sending',first_attempt_at=coalesce(first_attempt_at,t),lease_until=t+interval '2 minutes',attempt_count=attempt_count+1,updated_at=t WHERE batch_id=p_batch RETURNING * INTO x;
  RETURN jsonb_build_object('send',true,'retry_key',x.retry_key,'message',x.message);
 ELSIF p_action='finish' THEN
  IF x.status='accepted' THEN RETURN to_jsonb(x); END IF;
  UPDATE public.specials_line_outbox SET status=CASE WHEN p_result->>'status'='accepted' THEN 'accepted' WHEN p_result->>'status'='failed' THEN 'failed' ELSE 'uncertain' END,accepted_request_id=p_result->>'request_id',last_error=left(p_result->>'error',500),lease_until=NULL,updated_at=t WHERE batch_id=p_batch RETURNING * INTO x;
  RETURN to_jsonb(x);
 END IF;
 RAISE EXCEPTION 'Invalid announcement action';
END $$;
CREATE FUNCTION specials_private.sweep() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b record; n integer:=0;
BEGIN
 FOR b IN SELECT batch.id FROM public.specials_batches batch WHERE batch.status IN ('prepared','live') OR EXISTS(SELECT 1 FROM public.specials_checkouts c WHERE c.batch_id=batch.id AND (c.inventory_state IN ('held','verifying') OR c.fulfillment_state='ready')) ORDER BY batch.id LOOP PERFORM specials_private.reap_batch(b.id); n:=n+1; END LOOP;
 RETURN n;
END $$;
-- Public API surface. Private service functions are inaccessible to browser roles.
CREATE FUNCTION public.specials_catalog_v1() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.catalog() $$;
CREATE FUNCTION public.specials_checkout_v1(p_batch uuid,p_cart jsonb,p_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.checkout(p_batch,p_cart,p_key) $$;
CREATE FUNCTION public.specials_customer_state_v1(p_order uuid,p_cancel boolean DEFAULT false) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.customer_state(p_order,p_cancel) $$;
CREATE FUNCTION public.specials_pickup_v1(p_order uuid,p_location uuid) RETURNS SETOF public.orders LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM specials_private.pickup(p_order,p_location) $$;
CREATE FUNCTION public.specials_admin_details_v1() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.admin_details() $$;
CREATE FUNCTION public.specials_begin_verification_v1(p_order uuid,p_customer uuid,p_attempt uuid,p_path text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.begin_verification(p_order,p_customer,p_attempt,p_path) $$;
CREATE FUNCTION public.specials_finish_verification_v1(p_attempt uuid,p_evidence jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.finish_verification(p_attempt,p_evidence) $$;
CREATE FUNCTION public.specials_line_action_v1(p_action text,p_batch uuid,p_result jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.line_action(p_action,p_batch,p_result) $$;
CREATE FUNCTION public.specials_sweep_v1() RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.sweep() $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA specials_private FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA specials_private TO anon;
GRANT EXECUTE ON FUNCTION specials_private.catalog() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION specials_private.is_admin(),specials_private.admin_action(text,jsonb,uuid),specials_private.admin_details(),specials_private.checkout(uuid,jsonb,uuid),specials_private.customer_state(uuid,boolean),specials_private.pickup(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION specials_private.begin_verification(uuid,uuid,uuid,text),specials_private.finish_verification(uuid,jsonb),specials_private.line_action(text,uuid,jsonb),specials_private.sweep() TO service_role;
REVOKE ALL ON FUNCTION public.specials_catalog_v1(),public.specials_checkout_v1(uuid,jsonb,uuid),public.specials_customer_state_v1(uuid,boolean),public.specials_pickup_v1(uuid,uuid),public.specials_admin_details_v1(),public.specials_begin_verification_v1(uuid,uuid,uuid,text),public.specials_finish_verification_v1(uuid,jsonb),public.specials_line_action_v1(text,uuid,jsonb),public.specials_sweep_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.specials_catalog_v1() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.specials_checkout_v1(uuid,jsonb,uuid),public.specials_customer_state_v1(uuid,boolean),public.specials_pickup_v1(uuid,uuid),public.specials_admin_details_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.specials_begin_verification_v1(uuid,uuid,uuid,text),public.specials_finish_verification_v1(uuid,jsonb),public.specials_line_action_v1(text,uuid,jsonb),public.specials_sweep_v1() TO service_role;
-- Browser roles cannot relabel, insert or directly mutate Specials orders via staff policies.
CREATE FUNCTION specials_private.guard_order() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND (NEW.order_type='specials' OR (TG_OP='UPDATE' AND OLD.order_type='specials')) THEN RAISE EXCEPTION 'Use the authorized Specials workflow'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER specials_order_guard BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION specials_private.guard_order();
-- Existing privileged RPCs must reject Specials before any stock, payment or loyalty side effects.
-- Patch bodies fail closed against the known signatures. Preserve all regular-order behavior.
DO $guards$
DECLARE f record; definition text; injection text;
BEGIN
 FOR f IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('cancel_online_order','cancel_online_order_legacy_v1','cancel_online_order_v2','cancel_online_order_v2_inventory_v1','staff_record_order_payment_v2','staff_repair_completed_order_payment_method_v2','staff_redeem_loyalty_reward_v2','refund_reserved_order_loyalty_reward_v2','apply_loyalty_points_delta_v2','claim_order_notification','confirm_order_pickup','create_or_get_payment_transaction_v1','finalize_verified_payment_v1','expire_payment_transaction_v1') LOOP
  definition:=pg_get_functiondef(f.oid);
  IF position(E'BEGIN\n' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected RPC body: %',f.proname; END IF;
  IF f.proname='expire_payment_transaction_v1' THEN
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.specials_checkouts c JOIN public.payment_transactions t ON t.order_id=c.order_id WHERE t.id=p_payment_transaction_id) THEN PERFORM specials_private.reap_batch((SELECT c.batch_id FROM public.specials_checkouts c JOIN public.payment_transactions t ON t.order_id=c.order_id WHERE t.id=p_payment_transaction_id)); RETURN jsonb_build_object(''state'',''specials_swept''); END IF;\n';
  ELSIF f.proname='claim_order_notification' THEN
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''specials'' AND (payment_status<>''paid'' OR p_notification_type=''customer_confirmation'')) THEN RETURN jsonb_build_object(''outcome'',''unavailable''); END IF;\n';
  ELSIF f.proname='finalize_verified_payment_v1' THEN
   injection:=E'BEGIN\n  PERFORM pg_advisory_xact_lock(hashtextextended(''easyslip:''||p_provider_transaction_ref,811));\n  IF EXISTS(SELECT 1 FROM specials_private.receipts WHERE provider_ref=p_provider_transaction_ref) OR EXISTS(SELECT 1 FROM public.orders o JOIN public.payment_transactions t ON t.order_id=o.id WHERE t.id=p_payment_transaction_id AND o.order_type=''specials'') THEN RAISE EXCEPTION ''Use Specials payment verification''; END IF;\n';
  ELSE
   injection:=E'BEGIN\n  IF EXISTS(SELECT 1 FROM public.orders WHERE id=p_order_id AND order_type=''specials'') THEN RAISE EXCEPTION ''Use the authorized Specials workflow''; END IF;\n';
  END IF;
  EXECUTE regexp_replace(definition,E'BEGIN\n',injection);
 END LOOP;
END $guards$;
DO $cron$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  PERFORM cron.schedule('joko-specials-expiry-v1','* * * * *','SELECT specials_private.sweep()');
 END IF;
END $cron$;
-- Static Thai merchant QR validation: TLV, currency, country, CRC, no fixed amount.
CREATE FUNCTION specials_private.valid_merchant_qr(payload text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE pos integer:=1; tag text; size integer; value text; crc integer:=65535; idx integer; bit integer; currency_ok boolean:=false; country_ok boolean:=false; merchant_ok boolean:=false; initiation_ok boolean:=false; seen text[]:=ARRAY[]::text[];
BEGIN
 IF payload IS NULL OR length(payload) NOT BETWEEN 30 AND 2048 OR payload !~ '^000201' OR right(payload,8)!~'^6304[0-9A-Fa-f]{4}$' THEN RETURN false; END IF;
 WHILE pos<=length(payload) LOOP
  tag:=substring(payload,pos,2);
  IF substring(payload,pos+2,2)!~'^[0-9]{2}$' OR tag=ANY(seen) THEN RETURN false; END IF;
  seen:=array_append(seen,tag); size:=substring(payload,pos+2,2)::integer;value:=substring(payload,pos+4,size);
  IF length(value)<>size THEN RETURN false; END IF;
  IF tag='54' THEN RETURN false; END IF;
  IF tag='01' THEN initiation_ok:=value='11'; END IF;
  IF tag='53' THEN currency_ok:=value='764'; END IF;
  IF tag='58' THEN country_ok:=value='TH'; END IF;
  IF tag IN ('29','30','31') THEN merchant_ok:=length(value)>10; END IF;
  pos:=pos+4+size;
 END LOOP;
 IF pos<>length(payload)+1 OR NOT currency_ok OR NOT country_ok OR NOT merchant_ok OR NOT initiation_ok THEN RETURN false; END IF;
 FOR idx IN 1..length(payload)-4 LOOP
  crc:=crc # (ascii(substring(payload,idx,1))<<8);
  FOR bit IN 1..8 LOOP crc:=CASE WHEN crc & 32768<>0 THEN ((crc<<1)#4129)&65535 ELSE (crc<<1)&65535 END; END LOOP;
 END LOOP;
 RETURN lpad(upper(to_hex(crc)),4,'0')=upper(right(payload,4));
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
ALTER TABLE specials_private.settings ADD CONSTRAINT specials_static_merchant_qr CHECK(NOT enabled OR specials_private.valid_merchant_qr(qr_payload));
-- Disable regular loyalty calculation for Specials on insert, after the existing trigger.
CREATE FUNCTION specials_private.zero_specials_points() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.order_type='specials' THEN NEW.loyalty_points_earned:=0;NEW.loyalty_multiplier:=0; END IF; RETURN NEW;
END $$;
CREATE TRIGGER zz_specials_points BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION specials_private.zero_specials_points();
-- Durable audit and retry protection for the extended admin actions.
CREATE TABLE specials_private.operations(operation_key uuid PRIMARY KEY,actor_id uuid NOT NULL REFERENCES auth.users(id),action text NOT NULL,request jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
REVOKE ALL ON specials_private.operations FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION specials_private.admin_action(text,jsonb,uuid) RENAME TO operational_action;
CREATE FUNCTION specials_private.admin_action(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous specials_private.operations%ROWTYPE; result jsonb;
BEGIN
 IF NOT specials_private.is_admin() OR p_operation_key IS NULL THEN RAISE EXCEPTION 'Admin and operation key required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation_key::text,731));
 IF p_action IN ('save_batch','save_item','transfer','prepare','close','cancel') THEN
  IF EXISTS(SELECT 1 FROM specials_private.operations WHERE operation_key=p_operation_key) THEN RAISE EXCEPTION 'Operation key belongs to a different request'; END IF;
  RETURN specials_private.operational_action(p_action,p_request,p_operation_key);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation_key::text,731));
 SELECT * INTO previous FROM specials_private.operations WHERE operation_key=p_operation_key;
 IF FOUND THEN
  IF previous.actor_id<>auth.uid() OR previous.action IS DISTINCT FROM p_action OR previous.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'Operation key belongs to a different request'; END IF;
  RETURN previous.result;
 END IF;
 IF EXISTS(SELECT 1 FROM public.specials_audit_events WHERE operation_key=p_operation_key) THEN RAISE EXCEPTION 'Operation key belongs to a different request'; END IF;
 result:=specials_private.operational_action(p_action,p_request,p_operation_key);
 INSERT INTO specials_private.operations VALUES(p_operation_key,auth.uid(),p_action,p_request,result,clock_timestamp());
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.admin_specials_action_v1(p_action text,p_request jsonb,p_operation_key uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT specials_private.admin_action(p_action,p_request,p_operation_key) $$;
REVOKE ALL ON FUNCTION specials_private.operational_action(text,jsonb,uuid),specials_private.admin_action(text,jsonb,uuid),specials_private.valid_merchant_qr(text),specials_private.zero_specials_points() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION specials_private.admin_action(text,jsonb,uuid) TO authenticated;

REVOKE ALL ON FUNCTION specials_private.guard_order() FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX specials_hold_lines_item_idx ON specials_private.hold_lines(item_id);
CREATE INDEX specials_attempts_order_idx ON specials_private.attempts(order_id);
CREATE UNIQUE INDEX specials_refund_reference_unique ON specials_private.receipts(refund_reference) WHERE refund_reference IS NOT NULL;
CREATE INDEX specials_receipts_order_idx ON specials_private.receipts(order_id);
CREATE INDEX specials_checkout_batch_all_idx ON public.specials_checkouts(batch_id);
COMMIT;
