-- Requires pickup_windows_v1_foundation. No Cron job, provider activation or legacy sender handover.
BEGIN;
GRANT USAGE ON SCHEMA private TO service_role;
ALTER TABLE public.order_notification_events DROP CONSTRAINT order_notification_events_notification_type_check;
ALTER TABLE public.order_notification_events ADD CONSTRAINT order_notification_events_notification_type_check
 CHECK(notification_type IN ('customer_confirmation','admin_new_order','customer_cancellation','payment_confirmation',
 'pickup_reminder','pickup_completed','pickup_not_collected'));
ALTER TABLE public.order_notification_events
 ADD COLUMN canonical_event_type text,
 ADD COLUMN worker_owner text NOT NULL DEFAULT 'legacy' CHECK(worker_owner IN ('legacy','unified')),
 ADD COLUMN event_state text NOT NULL DEFAULT 'ready' CHECK(event_state IN ('scheduled','ready','completed','cancelled')),
 ADD COLUMN scheduled_for timestamptz,
 ADD COLUMN anchor_at timestamptz,
 ADD COLUMN expires_at timestamptz,
 ADD COLUMN policy_snapshot jsonb,
 ADD COLUMN operation_revision integer,
 ADD COLUMN customer_id uuid,
 ADD COLUMN payload jsonb,
 ADD COLUMN held_reason text,
 ADD COLUMN disposition text,
 ADD CONSTRAINT unified_pickup_event_metadata_v1 CHECK(worker_owner='legacy' OR
 (canonical_event_type=notification_type AND notification_type IN ('pickup_reminder','pickup_completed','pickup_not_collected')
 AND scheduled_for IS NOT NULL AND anchor_at IS NOT NULL AND expires_at IS NOT NULL AND customer_id IS NOT NULL
 AND policy_snapshot IS NOT NULL AND jsonb_typeof(policy_snapshot)='object' AND operation_revision IS NOT NULL AND operation_revision>=1));
UPDATE public.order_notification_events SET canonical_event_type=CASE notification_type
 WHEN 'customer_confirmation' THEN 'order_confirmed' WHEN 'customer_cancellation' THEN 'order_cancelled'
 WHEN 'payment_confirmation' THEN 'payment_received' ELSE notification_type END;
CREATE INDEX notification_events_due_v1 ON public.order_notification_events(scheduled_for,id)
 WHERE worker_owner='unified' AND event_state IN ('scheduled','ready');

CREATE TABLE private.notification_settings_v1(
 event_type text PRIMARY KEY CHECK(event_type IN ('pickup_reminder','pickup_completed','pickup_not_collected')),
 enabled boolean NOT NULL DEFAULT false,
 email_enabled boolean NOT NULL,
 line_enabled boolean NOT NULL DEFAULT false,
 timing_minutes integer NOT NULL CHECK(timing_minutes BETWEEN 0 AND 10080),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 enrollment_after timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid,
 CHECK(event_type<>'pickup_completed' OR timing_minutes=0)
);
INSERT INTO private.notification_settings_v1(event_type,email_enabled,timing_minutes) VALUES
 ('pickup_reminder',true,1440),('pickup_completed',false,0),('pickup_not_collected',true,15);
CREATE TABLE private.notification_control_v1(
 id boolean PRIMARY KEY DEFAULT true CHECK(id), paused boolean NOT NULL DEFAULT true,
 email_paused boolean NOT NULL DEFAULT true,line_paused boolean NOT NULL DEFAULT true,
 line_context text, line_destination text,last_tick_at timestamptz,last_tick_counts jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.notification_control_v1(id) VALUES(true);
CREATE TABLE public.notification_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.order_notification_events(id) ON DELETE CASCADE,
 channel text NOT NULL CHECK(channel IN ('email','line')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','skipped','uncertain')),
 attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),next_attempt_at timestamptz DEFAULT now(),
 lease_token uuid,lease_expires_at timestamptz,first_request_at timestamptz,acceptance_uncertain boolean NOT NULL DEFAULT false,
 provider_key uuid NOT NULL DEFAULT gen_random_uuid(),template_version text NOT NULL DEFAULT 'pickup-v1',
 recipient text,request_body text,request_hash text,provider_context text,
 provider_message_id text,sent_at timestamptz,reason text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_id,channel),CHECK((request_body IS NULL)=(recipient IS NULL)),
 CHECK(request_body IS NULL OR (request_hash IS NOT NULL AND request_hash ~ '^[0-9a-f]{64}$')),
 CHECK(request_body IS NULL OR channel<>'line' OR provider_context IS NOT NULL),
 CHECK(attempt_count<=4)
);
CREATE INDEX notification_delivery_due_v1 ON public.notification_deliveries(next_attempt_at,id)
 WHERE status IN ('pending','failed','sending');
CREATE TABLE public.notification_delivery_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),delivery_id uuid NOT NULL REFERENCES public.notification_deliveries(id) ON DELETE CASCADE,
 attempt_number integer NOT NULL,lease_token uuid NOT NULL UNIQUE,started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,outcome text,reason text,provider_message_id text,
 UNIQUE(delivery_id,attempt_number)
);
CREATE TABLE private.notification_audit_v1(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid,action text NOT NULL,
 event_type text,before_values jsonb,after_values jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.line_oa_relationships_v1(
 provider_context text NOT NULL,destination text NOT NULL,line_user_id text NOT NULL CHECK(line_user_id ~ '^U[0-9a-f]{32}$'),
 friendship text NOT NULL CHECK(friendship IN ('friend','not_friend','unknown')),source text NOT NULL DEFAULT 'webhook' CHECK(source IN ('webhook','login_api')),observed_at timestamptz NOT NULL,
 PRIMARY KEY(provider_context,destination,line_user_id)
);
CREATE TABLE private.line_webhook_receipts_v1(
 provider_context text NOT NULL,destination text NOT NULL,event_id text NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(provider_context,destination,event_id)
);
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['notification_settings_v1','notification_control_v1','notification_audit_v1','line_oa_relationships_v1','line_webhook_receipts_v1'] LOOP
 EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON private.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END;$$;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_deliveries,public.notification_delivery_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.notification_deliveries,public.notification_delivery_attempts TO service_role;
-- All writes pass narrow RPCs; no new browser table privileges.

CREATE FUNCTION private.enqueue_pickup_notification_v1(p_order public.orders,p_type text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.notification_settings_v1%ROWTYPE;op public.pickup_date_locations%ROWTYPE;
 e public.order_notification_events%ROWTYPE;anchor timestamptz;due timestamptz;deadline timestamptz;lang text;
BEGIN
 SELECT * INTO s FROM private.notification_settings_v1 WHERE event_type=p_type;
 IF NOT FOUND OR NOT s.enabled OR (p_order.created_at IS NULL OR p_order.created_at<s.enrollment_after) OR p_order.purchase_type IS DISTINCT FROM 'online'
 OR p_order.customer_id IS NULL OR p_order.pickup_date IS NULL OR p_order.pickup_date_id IS NULL OR p_order.pickup_location_id IS NULL THEN RETURN;END IF;
 SELECT * INTO op FROM public.pickup_date_locations WHERE pickup_date_id=p_order.pickup_date_id AND location_id=p_order.pickup_location_id;
 IF NOT FOUND OR op.pickup_open_time IS NULL THEN RETURN;END IF;
 IF p_type='pickup_completed' THEN
  IF p_order.status NOT IN ('picked_up','completed') OR p_order.picked_up_at IS NULL THEN RETURN;END IF;
  anchor:=p_order.picked_up_at;due:=anchor;deadline:=anchor+interval '7 days';
 ELSE
  IF p_order.status NOT IN ('pending','confirmed','ready') OR p_order.picked_up_at IS NOT NULL THEN RETURN;END IF;
  anchor:=(p_order.pickup_date+CASE WHEN p_type='pickup_reminder' THEN op.pickup_open_time ELSE op.pickup_close_time END) AT TIME ZONE 'Asia/Bangkok';
  due:=anchor+make_interval(mins=>CASE WHEN p_type='pickup_reminder' THEN -s.timing_minutes ELSE s.timing_minutes END);
  deadline:=CASE WHEN p_type='pickup_reminder' THEN anchor ELSE due+interval '12 hours' END;
 END IF;
 SELECT CASE WHEN preferred_language IN ('en','th','zh') THEN preferred_language ELSE 'en' END INTO lang
 FROM public.user_profiles WHERE id=p_order.customer_id;
 INSERT INTO public.order_notification_events(order_id,notification_type,language,canonical_event_type,worker_owner,event_state,
 scheduled_for,anchor_at,expires_at,policy_snapshot,operation_revision,customer_id)
 VALUES(p_order.id,p_type,coalesce(lang,'en'),p_type,'unified','scheduled',due,anchor,deadline,to_jsonb(s),op.pickup_window_revision,p_order.customer_id)
 ON CONFLICT(order_id,notification_type) DO NOTHING RETURNING * INTO e;
 IF NOT FOUND THEN RETURN;END IF;
 IF s.email_enabled THEN INSERT INTO public.notification_deliveries(event_id,channel,next_attempt_at) VALUES(e.id,'email',due);END IF;
 IF s.line_enabled THEN INSERT INTO public.notification_deliveries(event_id,channel,next_attempt_at) VALUES(e.id,'line',due);END IF;
 IF NOT s.email_enabled AND NOT s.line_enabled THEN
 UPDATE public.order_notification_events SET event_state='completed',disposition='no_channels' WHERE id=e.id;END IF;
END;$$;

CREATE FUNCTION private.pickup_notification_transition_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM private.enqueue_pickup_notification_v1(NEW,'pickup_reminder');
  PERFORM private.enqueue_pickup_notification_v1(NEW,'pickup_not_collected');
 ELSIF NEW.status IN ('picked_up','completed') AND NEW.picked_up_at IS NOT NULL
  AND (OLD.picked_up_at IS NULL OR OLD.status NOT IN ('picked_up','completed')) THEN
  PERFORM private.enqueue_pickup_notification_v1(NEW,'pickup_completed');
 END IF;
 -- Cancel unsent work after the authoritative transaction; never rewrite accepted sends.
 IF NEW.status='cancelled' OR NEW.status IN ('picked_up','completed') OR NEW.picked_up_at IS NOT NULL THEN
  UPDATE public.order_notification_events SET event_state='cancelled',disposition=CASE WHEN NEW.status='cancelled' THEN 'order_cancelled' ELSE 'pickup_already_confirmed' END,updated_at=now()
  WHERE order_id=NEW.id AND worker_owner='unified' AND notification_type IN ('pickup_reminder','pickup_not_collected') AND event_state IN ('scheduled','ready');
  UPDATE public.notification_deliveries d SET status=CASE WHEN d.acceptance_uncertain THEN 'uncertain' ELSE 'skipped' END,next_attempt_at=NULL,reason=e.disposition,updated_at=now()
  FROM public.order_notification_events e WHERE e.id=d.event_id AND e.order_id=NEW.id AND e.worker_owner='unified'
   AND e.event_state='cancelled' AND d.status IN ('pending','failed');
 END IF;
 IF TG_OP='UPDATE' AND (OLD.pickup_date IS DISTINCT FROM NEW.pickup_date OR OLD.pickup_window_revision IS DISTINCT FROM NEW.pickup_window_revision OR OLD.pickup_date_id IS DISTINCT FROM NEW.pickup_date_id OR OLD.pickup_location_id IS DISTINCT FROM NEW.pickup_location_id
 OR OLD.pickup_slot_start IS DISTINCT FROM NEW.pickup_slot_start OR OLD.pickup_slot_end IS DISTINCT FROM NEW.pickup_slot_end
 OR OLD.customer_id IS DISTINCT FROM NEW.customer_id) THEN
  UPDATE public.order_notification_events SET held_reason='order_changed_requires_review',updated_at=now()
  WHERE order_id=NEW.id AND worker_owner='unified' AND event_state IN ('scheduled','ready');
 END IF;
 -- Reactivation is intentionally held, not automatically replayed.
 IF TG_OP='UPDATE' AND OLD.status='cancelled' AND NEW.status IN ('pending','confirmed','ready') THEN
  UPDATE public.order_notification_events SET held_reason='reactivation_requires_review',updated_at=now()
  WHERE order_id=NEW.id AND worker_owner='unified' AND event_state='cancelled';
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER pickup_notification_transition_v1 AFTER INSERT OR UPDATE OF status,picked_up_at,pickup_date,pickup_window_revision,pickup_date_id,pickup_location_id,pickup_slot_start,pickup_slot_end,customer_id
ON public.orders FOR EACH ROW EXECUTE FUNCTION private.pickup_notification_transition_v1();

CREATE FUNCTION private.notification_reason_v1(e public.order_notification_events,o public.orders)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.notification_settings_v1%ROWTYPE;revision integer;
BEGIN
 SELECT * INTO s FROM private.notification_settings_v1 WHERE event_type=e.notification_type;
 IF e.worker_owner<>'unified' THEN RETURN 'legacy_owner';END IF;
 IF e.event_state='cancelled' THEN RETURN coalesce(e.disposition,'event_cancelled');END IF;
 IF e.held_reason IS NOT NULL THEN RETURN e.held_reason;END IF;
 IF NOT s.enabled THEN RETURN 'event_disabled';END IF;
 IF e.expires_at<=now() THEN RETURN 'notification_stale';END IF;
 IF o.customer_id IS DISTINCT FROM e.customer_id OR o.purchase_type IS DISTINCT FROM 'online' THEN RETURN 'order_changed_requires_review';END IF;
 IF o.status='cancelled' THEN RETURN 'order_cancelled';END IF;
 IF o.payment_status IS DISTINCT FROM 'paid' AND EXISTS(SELECT 1 FROM public.payment_transactions pt WHERE pt.order_id=o.id
 AND (pt.status IN ('expired','cancelled') OR (pt.status<>'verified' AND pt.expires_at<=now()))) THEN RETURN 'payment_expired';END IF;
 IF e.notification_type='pickup_completed' THEN
  IF o.picked_up_at IS DISTINCT FROM e.anchor_at OR o.status NOT IN ('picked_up','completed') THEN RETURN 'pickup_reversed_requires_review';END IF;
 ELSE
  IF o.picked_up_at IS NOT NULL OR o.status IN ('picked_up','completed') THEN RETURN 'pickup_already_confirmed';END IF;
  IF o.status NOT IN ('pending','confirmed','ready') THEN RETURN 'order_not_collectable';END IF;
 END IF;
 SELECT pickup_window_revision INTO revision FROM public.pickup_date_locations
 WHERE pickup_date_id=o.pickup_date_id AND location_id=o.pickup_location_id;
 IF revision IS NULL OR revision IS DISTINCT FROM e.operation_revision THEN RETURN 'operation_changed_requires_review';END IF;
 RETURN NULL;
END;$$;

CREATE FUNCTION private.notification_recipient_v1(p_customer uuid,p_channel text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE recipient text;c private.notification_control_v1%ROWTYPE;
BEGIN
 IF p_channel='email' THEN
  SELECT email INTO recipient FROM auth.users WHERE id=p_customer AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL
   AND (banned_until IS NULL OR banned_until<now());
 ELSE
  SELECT * INTO c FROM private.notification_control_v1 WHERE id=true;
  SELECT i.provider_id INTO recipient FROM auth.identities i JOIN auth.users u ON u.id=i.user_id
  JOIN private.line_oa_relationships_v1 r ON r.line_user_id=i.provider_id AND r.provider_context=c.line_context AND r.destination=c.line_destination
  WHERE i.user_id=p_customer AND i.provider='custom:line' AND i.provider_id=i.identity_data->>'sub'
   AND i.provider_id ~ '^U[0-9a-f]{32}$' AND r.friendship='friend' AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<now());
 END IF;
 RETURN nullif(btrim(recipient),'');
END;$$;

CREATE FUNCTION private.notification_aggregate_v1(p_event uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.order_notification_events e SET event_state='completed',updated_at=now(),
 disposition=CASE WHEN EXISTS(SELECT 1 FROM public.notification_deliveries d WHERE d.event_id=e.id AND d.status='uncertain') THEN 'needs_review'
 WHEN EXISTS(SELECT 1 FROM public.notification_deliveries d WHERE d.event_id=e.id AND d.status='sent') THEN
  CASE WHEN EXISTS(SELECT 1 FROM public.notification_deliveries d WHERE d.event_id=e.id AND d.status<>'sent') THEN 'partly_sent' ELSE 'sent' END
 ELSE 'not_sent' END
 WHERE e.id=p_event AND e.event_state<>'cancelled' AND NOT EXISTS(SELECT 1 FROM public.notification_deliveries d WHERE d.event_id=e.id
 AND (d.status IN ('pending','sending') OR (d.status='failed' AND d.next_attempt_at IS NOT NULL)));
$$;

CREATE FUNCTION private.notification_claim_v1(p_channel text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c private.notification_control_v1%ROWTYPE;s private.notification_settings_v1%ROWTYPE;
 d public.notification_deliveries%ROWTYPE;e public.order_notification_events%ROWTYPE;o public.orders%ROWTYPE;
 candidate record;why text;recipient text;location jsonb;new_token uuid;
BEGIN
 IF p_channel NOT IN ('email','line') OR p_channel IS NULL THEN RAISE EXCEPTION 'Invalid channel';END IF;
 SELECT * INTO c FROM private.notification_control_v1 WHERE id=true FOR SHARE;
 IF c.paused OR (p_channel='email' AND c.email_paused) OR (p_channel='line' AND c.line_paused) THEN RETURN NULL;END IF;
 FOR candidate IN SELECT nd.id,ne.id event_id,ne.order_id,ne.notification_type FROM public.notification_deliveries nd
 JOIN public.order_notification_events ne ON ne.id=nd.event_id
 WHERE nd.channel=p_channel AND ne.worker_owner='unified' AND ne.held_reason IS NULL
 AND ((ne.event_state IN ('scheduled','ready') AND ne.scheduled_for<=now()) OR nd.status='sending')
 AND ((nd.status IN ('pending','failed') AND nd.next_attempt_at<=now()) OR (nd.status='sending' AND nd.lease_expires_at<=clock_timestamp()))
 ORDER BY ne.scheduled_for,nd.id LIMIT 50 LOOP
  SELECT * INTO s FROM private.notification_settings_v1 WHERE event_type=candidate.notification_type FOR SHARE;
  -- Consistent order -> event -> delivery locks matches pickup transition triggers.
  SELECT * INTO o FROM public.orders WHERE id=candidate.order_id FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN CONTINUE;END IF;
  SELECT * INTO e FROM public.order_notification_events WHERE id=candidate.event_id FOR UPDATE;
  SELECT * INTO d FROM public.notification_deliveries WHERE id=candidate.id FOR UPDATE SKIP LOCKED;
  IF NOT FOUND OR NOT ((d.status IN ('pending','failed') AND d.next_attempt_at<=now()) OR (d.status='sending' AND d.lease_expires_at<=clock_timestamp())) THEN CONTINUE;END IF;
  -- An expired lease may have sent; keep request/key and close the stale attempt as uncertain.
  IF d.status='sending' THEN
   IF d.first_request_at IS NOT NULL THEN UPDATE public.notification_deliveries SET acceptance_uncertain=true WHERE id=d.id;d.acceptance_uncertain:=true;END IF;
   UPDATE public.notification_delivery_attempts SET finished_at=now(),outcome='uncertain',reason='lease_expired'
   WHERE lease_token=d.lease_token AND finished_at IS NULL;
  END IF;
  why:=private.notification_reason_v1(e,o);
  IF why IS NULL AND ((p_channel='email' AND NOT s.email_enabled) OR (p_channel='line' AND NOT s.line_enabled)) THEN why:='channel_disabled';END IF;
  recipient:=private.notification_recipient_v1(e.customer_id,p_channel);
  IF why IS NULL AND recipient IS NULL THEN why:=CASE WHEN p_channel='email' THEN 'no_verified_email' ELSE 'line_not_eligible' END;END IF;
  IF why IS NULL AND p_channel='line' AND d.provider_context IS NOT NULL AND d.provider_context IS DISTINCT FROM c.line_context||'/'||c.line_destination THEN why:='provider_context_changed_requires_review';END IF;
  IF why IS NULL AND d.recipient IS NOT NULL AND d.recipient IS DISTINCT FROM recipient THEN why:='recipient_changed_requires_review';END IF;
  IF why IS NOT NULL THEN
   IF why LIKE '%requires_review' THEN UPDATE public.order_notification_events SET held_reason=why WHERE id=e.id;
   ELSE UPDATE public.notification_deliveries SET status=CASE WHEN d.acceptance_uncertain THEN 'uncertain' ELSE 'skipped' END,reason=why,next_attempt_at=NULL,updated_at=now() WHERE id=d.id;
    PERFORM private.notification_aggregate_v1(e.id);END IF;
   CONTINUE;
  END IF;
  IF d.first_request_at<=now()-interval '23 hours' OR d.attempt_count>=4 THEN
   UPDATE public.notification_deliveries SET status=CASE WHEN d.acceptance_uncertain OR (d.status='sending' AND d.first_request_at IS NOT NULL) THEN 'uncertain' ELSE 'failed' END,
    reason=CASE WHEN d.first_request_at<=now()-interval '23 hours' THEN 'provider_safe_window_exceeded' ELSE 'retry_limit' END,next_attempt_at=NULL,updated_at=now() WHERE id=d.id;
   PERFORM private.notification_aggregate_v1(e.id);CONTINUE;
  END IF;
  IF e.payload IS NULL THEN
   location:=o.pickup_location_snapshot;
   IF location IS NULL THEN SELECT jsonb_build_object('name_en',name_en,'name_th',name_th,'name_zh',name_zh,'maps_url',maps_url)
    INTO location FROM public.cms_pickup_locations WHERE id=o.pickup_location_id;END IF;
   UPDATE public.order_notification_events SET payload=jsonb_build_object('version',1,'event_type',e.notification_type,'order_number',o.order_number,
    'pickup_date',o.pickup_date,'slot_start',o.pickup_slot_start,'slot_end',o.pickup_slot_end,'location',location),event_state='ready',updated_at=now()
   WHERE id=e.id RETURNING * INTO e;
  END IF;
  new_token:=gen_random_uuid();
  UPDATE public.notification_deliveries SET status='sending',attempt_count=attempt_count+1,lease_token=new_token,
   lease_expires_at=clock_timestamp()+interval '2 minutes',updated_at=now() WHERE id=d.id RETURNING * INTO d;
  INSERT INTO public.notification_delivery_attempts(delivery_id,attempt_number,lease_token) VALUES(d.id,d.attempt_count,new_token);
  RETURN jsonb_build_object('delivery_id',d.id,'event_id',e.id,'lease_token',new_token,'channel',p_channel,'language',e.language,
   'payload',e.payload,'recipient',coalesce(d.recipient,recipient),'provider_key',d.provider_key,'template_version',d.template_version,'request_body',d.request_body,'line_context',c.line_context,'line_destination',c.line_destination);
 END LOOP;
 RETURN NULL;
END;$$;

CREATE FUNCTION private.notification_prepare_v1(p_delivery uuid,p_token uuid,p_recipient text,p_request text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.notification_deliveries%ROWTYPE;e public.order_notification_events%ROWTYPE;o public.orders%ROWTYPE;
 c private.notification_control_v1%ROWTYPE;s private.notification_settings_v1%ROWTYPE;event_id uuid;order_id uuid;why text;v_recipient text;
BEGIN
 SELECT * INTO c FROM private.notification_control_v1 WHERE id=true FOR SHARE;
 SELECT nd.event_id,ne.order_id INTO event_id,order_id FROM public.notification_deliveries nd JOIN public.order_notification_events ne ON ne.id=nd.event_id WHERE nd.id=p_delivery;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT ns.* INTO s FROM private.notification_settings_v1 ns JOIN public.order_notification_events ne ON ne.notification_type=ns.event_type WHERE ne.id=event_id FOR SHARE OF ns;
 SELECT * INTO o FROM public.orders WHERE id=order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO e FROM public.order_notification_events WHERE id=event_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO d FROM public.notification_deliveries WHERE id=p_delivery FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF d.status<>'sending' OR d.lease_token IS DISTINCT FROM p_token OR d.lease_expires_at<=clock_timestamp() THEN RETURN NULL;END IF;
 why:=private.notification_reason_v1(e,o);
 IF why IS NULL AND (c.paused OR (d.channel='email' AND c.email_paused) OR (d.channel='line' AND c.line_paused)) THEN why:='dispatcher_paused';END IF;
 IF why IS NULL AND ((d.channel='email' AND NOT s.email_enabled) OR (d.channel='line' AND NOT s.line_enabled)) THEN why:='channel_disabled';END IF;
 v_recipient:=private.notification_recipient_v1(e.customer_id,d.channel);
 IF why IS NULL AND (v_recipient IS NULL OR v_recipient IS DISTINCT FROM p_recipient OR (d.recipient IS NOT NULL AND d.recipient IS DISTINCT FROM v_recipient)) THEN why:='recipient_changed_requires_review';END IF;
 IF why IS NULL AND d.channel='line' AND d.provider_context IS NOT NULL AND d.provider_context IS DISTINCT FROM c.line_context||'/'||c.line_destination THEN why:='provider_context_changed_requires_review';END IF;
 IF why IS NULL AND d.first_request_at<=now()-interval '23 hours' THEN why:='provider_safe_window_exceeded';END IF;
 IF why IS NOT NULL THEN
  UPDATE public.notification_delivery_attempts SET finished_at=now(),outcome='suppressed',reason=why WHERE lease_token=p_token AND finished_at IS NULL;
  IF why='dispatcher_paused' THEN UPDATE public.notification_deliveries SET status='failed',next_attempt_at=now(),reason=why,lease_token=NULL,updated_at=now() WHERE id=d.id;
  ELSIF why LIKE '%requires_review' THEN UPDATE public.order_notification_events SET held_reason=why WHERE id=e.id;
   UPDATE public.notification_deliveries SET status='failed',next_attempt_at=now(),reason=why,lease_token=NULL,updated_at=now() WHERE id=d.id;
  ELSE UPDATE public.notification_deliveries SET status=CASE WHEN d.acceptance_uncertain THEN 'uncertain' ELSE 'skipped' END,next_attempt_at=NULL,reason=why,lease_token=NULL,updated_at=now() WHERE id=d.id;END IF;
  PERFORM private.notification_aggregate_v1(e.id);RETURN NULL;
 END IF;
 IF p_request IS NULL OR octet_length(p_request)>32000 OR jsonb_typeof(p_request::jsonb)<>'object' THEN RAISE EXCEPTION 'Invalid request';END IF;
 IF d.request_body IS NOT NULL AND d.request_body IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'Frozen provider request differs';END IF;
 UPDATE public.notification_deliveries SET recipient=v_recipient,provider_context=CASE WHEN d.channel='line' THEN coalesce(d.provider_context,c.line_context||'/'||c.line_destination) ELSE NULL END,request_body=coalesce(request_body,p_request),
  request_hash=coalesce(request_hash,encode(sha256(convert_to(p_request,'UTF8')),'hex')),first_request_at=coalesce(first_request_at,now()),updated_at=now() WHERE id=d.id RETURNING * INTO d;
 RETURN jsonb_build_object('request_body',d.request_body,'provider_key',d.provider_key);
END;$$;

CREATE FUNCTION private.notification_finish_v1(p_delivery uuid,p_token uuid,p_outcome text,p_provider_id text,p_reason text,p_retry_after_seconds integer DEFAULT 0)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.notification_deliveries%ROWTYPE;e public.order_notification_events%ROWTYPE;event_id uuid;order_id uuid;retry_minutes integer;
BEGIN
 IF p_retry_after_seconds IS NULL OR p_retry_after_seconds NOT BETWEEN 0 AND 604800 THEN RAISE EXCEPTION 'Invalid retry delay';END IF;
 IF p_outcome NOT IN ('sent','retryable','permanent','uncertain','pause_channel') OR p_outcome IS NULL THEN RETURN false;END IF;
 -- Control lock precedes order/event/delivery, including channel-pause outcomes.
 PERFORM 1 FROM private.notification_control_v1 WHERE id=true FOR UPDATE;
 SELECT nd.event_id,ne.order_id INTO event_id,order_id FROM public.notification_deliveries nd JOIN public.order_notification_events ne ON ne.id=nd.event_id WHERE nd.id=p_delivery;
 IF NOT FOUND THEN RETURN false;END IF;
 PERFORM 1 FROM public.orders WHERE id=order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 SELECT * INTO e FROM public.order_notification_events WHERE id=event_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 SELECT * INTO d FROM public.notification_deliveries WHERE id=p_delivery FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 IF d.status<>'sending' OR d.lease_token IS DISTINCT FROM p_token OR d.lease_expires_at<=clock_timestamp() THEN RETURN false;END IF;
 retry_minutes:=CASE d.attempt_count WHEN 1 THEN 5 WHEN 2 THEN 15 ELSE 60 END;
 UPDATE public.notification_delivery_attempts SET finished_at=now(),outcome=p_outcome,reason=left(p_reason,120),provider_message_id=left(p_provider_id,500)
 WHERE lease_token=p_token AND finished_at IS NULL;
 UPDATE public.notification_deliveries SET status=CASE WHEN p_outcome='sent' THEN 'sent' WHEN e.event_state='cancelled' THEN CASE WHEN p_outcome='uncertain' OR acceptance_uncertain THEN 'uncertain' ELSE 'skipped' END WHEN (p_outcome='uncertain' OR acceptance_uncertain) AND (attempt_count>=4 OR p_outcome='permanent') THEN 'uncertain' ELSE 'failed' END,
  next_attempt_at=CASE WHEN e.event_state<>'cancelled' AND p_outcome IN ('retryable','uncertain','pause_channel') AND attempt_count<4 THEN now()+make_interval(secs=>greatest(retry_minutes*60,p_retry_after_seconds)) ELSE NULL END,
  acceptance_uncertain=CASE WHEN p_outcome='sent' THEN false WHEN p_outcome='uncertain' THEN true ELSE acceptance_uncertain END,
  sent_at=CASE WHEN p_outcome='sent' THEN now() ELSE sent_at END,provider_message_id=left(p_provider_id,500),reason=CASE WHEN e.event_state='cancelled' AND p_outcome<>'sent' THEN coalesce(e.disposition,'event_cancelled') ELSE left(p_reason,120) END,lease_token=NULL,updated_at=now()
 WHERE id=d.id;
 IF p_outcome='pause_channel' THEN UPDATE private.notification_control_v1 SET email_paused=CASE WHEN d.channel='email' THEN true ELSE email_paused END,
 line_paused=CASE WHEN d.channel='line' THEN true ELSE line_paused END,updated_at=now() WHERE id=true;END IF;
 PERFORM private.notification_aggregate_v1(event_id);RETURN true;
END;$$;

CREATE FUNCTION private.line_oa_webhook_v1(p_context text,p_destination text,p_events jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c private.notification_control_v1%ROWTYPE;ev jsonb;event_id text;user_id text;state text;observed timestamptz;n integer:=0;
BEGIN
 SELECT * INTO c FROM private.notification_control_v1 WHERE id=true;
 IF c.line_context IS DISTINCT FROM p_context OR c.line_destination IS DISTINCT FROM p_destination OR p_context IS NULL THEN RAISE EXCEPTION 'LINE context is not verified';END IF;
 IF jsonb_typeof(p_events)<>'array' OR jsonb_array_length(p_events)>100 THEN RAISE EXCEPTION 'Invalid webhook batch';END IF;
 FOR ev IN SELECT value FROM jsonb_array_elements(p_events) LOOP
  event_id:=ev->>'webhookEventId';
  IF event_id IS NULL OR length(event_id)>200 THEN RAISE EXCEPTION 'Webhook ID required';END IF;
  INSERT INTO private.line_webhook_receipts_v1(provider_context,destination,event_id) VALUES(p_context,p_destination,event_id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN CONTINUE;END IF;
  n:=n+1;
  IF coalesce(ev->>'type','') NOT IN ('follow','unfollow') OR coalesce(ev->'source'->>'type','')<>'user' THEN CONTINUE;END IF;
  user_id:=ev->'source'->>'userId';
  IF user_id IS NULL OR user_id !~ '^U[0-9a-f]{32}$' THEN RAISE EXCEPTION 'Invalid LINE user';END IF;
  observed:=to_timestamp((ev->>'timestamp')::numeric/1000);
  IF observed IS NULL OR observed>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Invalid event timestamp';END IF;
  state:=CASE WHEN ev->>'type'='follow' THEN 'friend' ELSE 'not_friend' END;
  INSERT INTO private.line_oa_relationships_v1(provider_context,destination,line_user_id,friendship,observed_at)
  VALUES(p_context,p_destination,user_id,state,observed)
  ON CONFLICT(provider_context,destination,line_user_id) DO UPDATE SET
   friendship=CASE WHEN EXCLUDED.observed_at=line_oa_relationships_v1.observed_at AND EXCLUDED.friendship<>line_oa_relationships_v1.friendship THEN 'unknown' ELSE EXCLUDED.friendship END,
   source='webhook',observed_at=EXCLUDED.observed_at WHERE EXCLUDED.observed_at>=line_oa_relationships_v1.observed_at;
 END LOOP;
 RETURN n;
END;$$;

-- Service-only verified context setup; caller must inspect LINE console provider IDs first.
CREATE FUNCTION private.notification_line_context_v1(p_context text,p_destination text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_context IS NULL OR p_context !~ '^[0-9]{1,30}$' OR p_destination IS NULL OR p_destination !~ '^U[0-9a-f]{32}$' THEN RAISE EXCEPTION 'Invalid LINE context';END IF;
 IF EXISTS(SELECT 1 FROM private.notification_control_v1 WHERE id=true AND NOT line_paused) THEN RAISE EXCEPTION 'Pause LINE before changing context';END IF;
 UPDATE private.notification_control_v1 SET line_context=p_context,line_destination=p_destination,updated_at=now() WHERE id=true;
 INSERT INTO private.notification_audit_v1(action,after_values) VALUES('line_context_verified',jsonb_build_object('context',p_context,'destination',p_destination));
END;$$;

CREATE FUNCTION private.line_oa_sync_v1(p_customer uuid,p_line_user text,p_context text,p_destination text,p_friend boolean,p_observed_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c private.notification_control_v1%ROWTYPE;state text;
BEGIN
 SELECT * INTO c FROM private.notification_control_v1 WHERE id=true;
 IF p_context IS NULL OR c.line_context IS DISTINCT FROM p_context OR c.line_destination IS DISTINCT FROM p_destination THEN RAISE EXCEPTION 'LINE context not verified';END IF;
 IF p_friend IS NULL OR p_observed_at IS NULL OR p_observed_at>now()+interval '5 minutes' OR p_observed_at<now()-interval '5 minutes' THEN RAISE EXCEPTION 'Invalid friendship observation';END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.identities i WHERE i.user_id=p_customer AND i.provider='custom:line' AND i.provider_id=p_line_user AND i.provider_id=i.identity_data->>'sub') THEN RAISE EXCEPTION 'Linked LINE identity required';END IF;
 state:=CASE WHEN p_friend THEN 'friend' ELSE 'not_friend' END;
 INSERT INTO private.line_oa_relationships_v1(provider_context,destination,line_user_id,friendship,source,observed_at) VALUES(p_context,p_destination,p_line_user,state,'login_api',p_observed_at)
 ON CONFLICT(provider_context,destination,line_user_id) DO UPDATE SET
 friendship=CASE WHEN EXCLUDED.observed_at=line_oa_relationships_v1.observed_at AND EXCLUDED.friendship<>line_oa_relationships_v1.friendship THEN 'unknown' ELSE EXCLUDED.friendship END,
 source='login_api',observed_at=EXCLUDED.observed_at WHERE EXCLUDED.observed_at>=line_oa_relationships_v1.observed_at;
END;$$;
CREATE FUNCTION public.line_oa_sync_v1(p_customer uuid,p_line_user text,p_context text,p_destination text,p_friend boolean,p_observed_at timestamptz)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.line_oa_sync_v1(p_customer,p_line_user,p_context,p_destination,p_friend,p_observed_at);$$;

CREATE FUNCTION private.admin_notification_state_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('settings',(SELECT jsonb_agg(to_jsonb(s) ORDER BY event_type) FROM private.notification_settings_v1 s),
 'control',(SELECT jsonb_build_object('paused',paused,'email_paused',email_paused,'line_paused',line_paused,'line_ready',line_context IS NOT NULL AND line_destination IS NOT NULL,'updated_at',updated_at,'last_tick_at',last_tick_at,'last_tick_counts',last_tick_counts) FROM private.notification_control_v1 WHERE id=true),
 'backlog',(SELECT jsonb_build_object('due',count(*),'oldest_due',min(e.scheduled_for)) FROM public.order_notification_events e
 WHERE e.worker_owner='unified' AND e.event_state IN ('scheduled','ready') AND e.held_reason IS NULL AND e.scheduled_for<=now()),
 'shadow_candidates',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT o.id order_id,o.order_number,o.pickup_date,l.name_en,
 ((o.pickup_date+dl.pickup_close_time) AT TIME ZONE 'Asia/Bangkok')+make_interval(mins=>s.timing_minutes) scheduled_for
 FROM public.orders o JOIN public.pickup_dates pd ON pd.id=o.pickup_date_id AND pd.pickup_date=o.pickup_date
 JOIN public.pickup_date_locations dl ON dl.pickup_date_id=o.pickup_date_id AND dl.location_id=o.pickup_location_id
 JOIN public.cms_pickup_locations l ON l.id=o.pickup_location_id CROSS JOIN private.notification_settings_v1 s
 WHERE s.event_type='pickup_not_collected' AND o.created_at>=s.enrollment_after AND o.purchase_type='online' AND o.customer_id IS NOT NULL
 AND o.status IN ('pending','confirmed','ready') AND o.picked_up_at IS NULL AND dl.pickup_close_time IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.order_notification_events held WHERE held.order_id=o.id AND held.worker_owner='unified' AND held.held_reason IS NOT NULL)
 AND (((o.pickup_date+dl.pickup_close_time) AT TIME ZONE 'Asia/Bangkok')+make_interval(mins=>s.timing_minutes)) BETWEEN now()-interval '12 hours' AND now()
 AND NOT EXISTS(SELECT 1 FROM public.payment_transactions pt WHERE pt.order_id=o.id AND o.payment_status IS DISTINCT FROM 'paid'
 AND (pt.status IN ('expired','cancelled') OR (pt.status<>'verified' AND pt.expires_at<=now())))
 ORDER BY o.pickup_date,o.id LIMIT 100) x),
 'operations',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT pd.pickup_date,dl.pickup_open_time,dl.pickup_close_time,l.name_en FROM public.pickup_dates pd JOIN public.pickup_date_locations dl ON dl.pickup_date_id=pd.id JOIN public.cms_pickup_locations l ON l.id=dl.location_id WHERE pd.pickup_date>=timezone('Asia/Bangkok',now())::date AND dl.is_active AND dl.pickup_open_time IS NOT NULL ORDER BY pd.pickup_date,l.name_en LIMIT 20) x),
 'history',(SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (SELECT e.id,e.order_id,o.order_number,e.notification_type,e.language,e.scheduled_for,e.anchor_at,e.event_state,e.held_reason,e.disposition,
  (SELECT jsonb_agg(jsonb_build_object('channel',d.channel,'status',d.status,'attempt_count',d.attempt_count,'next_attempt_at',d.next_attempt_at,'reason',d.reason,'sent_at',d.sent_at,
   'recipient',CASE WHEN d.recipient IS NULL THEN NULL WHEN d.channel='email' THEN left(d.recipient,1)||'***@'||split_part(d.recipient,'@',2) ELSE left(d.recipient,2)||'***'||right(d.recipient,4) END,
   'attempts',(SELECT jsonb_agg(jsonb_build_object('number',a.attempt_number,'started_at',a.started_at,'finished_at',a.finished_at,'outcome',a.outcome,'reason',a.reason) ORDER BY a.attempt_number) FROM public.notification_delivery_attempts a WHERE a.delivery_id=d.id))) FROM public.notification_deliveries d WHERE d.event_id=e.id) deliveries
  FROM public.order_notification_events e JOIN public.orders o ON o.id=e.order_id WHERE e.worker_owner='unified' ORDER BY e.created_at DESC,e.id LIMIT 100) x));
END;$$;

CREATE FUNCTION private.admin_notification_setting_v1(p_type text,p_enabled boolean,p_email boolean,p_line boolean,p_minutes integer,p_version integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.notification_settings_v1%ROWTYPE;c private.notification_control_v1%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM private.notification_control_v1 WHERE id=true FOR SHARE;
 SELECT * INTO s FROM private.notification_settings_v1 WHERE event_type=p_type FOR UPDATE;
 IF NOT FOUND OR s.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Settings changed. Refresh first.';END IF;
 IF p_enabled IS NULL OR p_email IS NULL OR p_line IS NULL OR p_minutes IS NULL THEN RAISE EXCEPTION 'Settings required';END IF;
 IF p_enabled AND NOT (p_email OR p_line) THEN RAISE EXCEPTION 'Enable at least one channel';END IF;
 IF p_enabled AND p_line AND c.line_context IS NULL THEN RAISE EXCEPTION 'Verify LINE provider/OA context before enabling LINE';END IF;
 UPDATE private.notification_settings_v1 SET enabled=p_enabled,email_enabled=p_email,line_enabled=p_line,timing_minutes=p_minutes,
 version=version+1,enrollment_after=CASE WHEN p_enabled AND NOT s.enabled THEN now() ELSE enrollment_after END,updated_at=now(),updated_by=auth.uid() WHERE event_type=p_type;
 PERFORM 1 FROM public.order_notification_events WHERE worker_owner='unified' AND notification_type=p_type ORDER BY id FOR UPDATE;
 -- OFF terminally suppresses eligible unsent work; ON never replays it.
 UPDATE public.notification_deliveries d SET status=CASE WHEN d.acceptance_uncertain THEN 'uncertain' ELSE 'skipped' END,next_attempt_at=NULL,reason=CASE WHEN NOT p_enabled THEN 'event_disabled' ELSE 'channel_disabled' END,updated_at=now()
 FROM public.order_notification_events e WHERE e.id=d.event_id AND e.worker_owner='unified' AND e.notification_type=p_type
 AND d.status IN ('pending','failed') AND (NOT p_enabled OR (d.channel='email' AND NOT p_email) OR (d.channel='line' AND NOT p_line));
 IF NOT p_enabled THEN UPDATE public.order_notification_events SET event_state='cancelled',disposition='event_disabled',updated_at=now()
 WHERE worker_owner='unified' AND notification_type=p_type AND event_state IN ('scheduled','ready');END IF;
 INSERT INTO private.notification_audit_v1(actor_id,action,event_type,before_values,after_values)
 VALUES(auth.uid(),'settings',p_type,to_jsonb(s),(SELECT to_jsonb(ns) FROM private.notification_settings_v1 ns WHERE event_type=p_type));
END;$$;
CREATE FUNCTION private.admin_notification_pause_v1(p_paused boolean,p_email_paused boolean,p_line_paused boolean,p_updated_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c private.notification_control_v1%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM private.notification_control_v1 WHERE id=true FOR UPDATE;
 IF c.updated_at IS DISTINCT FROM p_updated_at THEN RAISE EXCEPTION 'Controls changed. Refresh first.';END IF;
 IF p_paused IS NULL OR p_email_paused IS NULL OR p_line_paused IS NULL THEN RAISE EXCEPTION 'Controls required';END IF;
 IF NOT p_line_paused AND c.line_context IS NULL THEN RAISE EXCEPTION 'LINE context not verified';END IF;
 UPDATE private.notification_control_v1 SET paused=p_paused,email_paused=p_email_paused,line_paused=p_line_paused,updated_at=now() WHERE id=true;
 INSERT INTO private.notification_audit_v1(actor_id,action,before_values,after_values) VALUES(auth.uid(),'pause',to_jsonb(c),jsonb_build_object('paused',p_paused,'email_paused',p_email_paused,'line_paused',p_line_paused));
END;$$;

CREATE FUNCTION private.notification_heartbeat_v1(p_counts jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF jsonb_typeof(p_counts)<>'object' OR octet_length(p_counts::text)>1000 THEN RAISE EXCEPTION 'Invalid heartbeat';END IF;
 UPDATE private.notification_control_v1 SET last_tick_at=now(),last_tick_counts=p_counts WHERE id=true;
END;$$;
CREATE FUNCTION public.notification_heartbeat_v1(p_counts jsonb) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.notification_heartbeat_v1(p_counts);$$;

-- Private implementation plus invoker façades; explicit grants below.
CREATE FUNCTION public.notification_claim_v1(p_channel text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.notification_claim_v1(p_channel);$$;
CREATE FUNCTION public.notification_prepare_v1(p_delivery uuid,p_token uuid,p_recipient text,p_request text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.notification_prepare_v1(p_delivery,p_token,p_recipient,p_request);$$;
CREATE FUNCTION public.notification_finish_v1(p_delivery uuid,p_token uuid,p_outcome text,p_provider_id text,p_reason text,p_retry_after_seconds integer DEFAULT 0) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.notification_finish_v1(p_delivery,p_token,p_outcome,p_provider_id,p_reason,p_retry_after_seconds);$$;
CREATE FUNCTION public.line_oa_webhook_v1(p_context text,p_destination text,p_events jsonb) RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.line_oa_webhook_v1(p_context,p_destination,p_events);$$;
CREATE FUNCTION public.notification_line_context_v1(p_context text,p_destination text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.notification_line_context_v1(p_context,p_destination);$$;
CREATE FUNCTION public.admin_notification_state_v1() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.admin_notification_state_v1();$$;
CREATE FUNCTION public.admin_notification_setting_v1(p_type text,p_enabled boolean,p_email boolean,p_line boolean,p_minutes integer,p_version integer) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.admin_notification_setting_v1(p_type,p_enabled,p_email,p_line,p_minutes,p_version);$$;
CREATE FUNCTION public.admin_notification_pause_v1(p_paused boolean,p_email_paused boolean,p_line_paused boolean,p_updated_at timestamptz) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.admin_notification_pause_v1(p_paused,p_email_paused,p_line_paused,p_updated_at);$$;
DO $$DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private') AND p.proname IN ('enqueue_pickup_notification_v1','pickup_notification_transition_v1','notification_reason_v1','notification_recipient_v1','notification_aggregate_v1',
 'notification_claim_v1','notification_prepare_v1','notification_finish_v1','notification_heartbeat_v1','line_oa_webhook_v1','line_oa_sync_v1','notification_line_context_v1','admin_notification_state_v1','admin_notification_setting_v1','admin_notification_pause_v1') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.sig);
 IF f.proname LIKE 'admin_notification_%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);
 ELSIF f.proname IN ('notification_claim_v1','notification_prepare_v1','notification_finish_v1','notification_heartbeat_v1','line_oa_webhook_v1','line_oa_sync_v1','notification_line_context_v1') THEN
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig);END IF;
 END LOOP;
END;$$;
COMMIT;
