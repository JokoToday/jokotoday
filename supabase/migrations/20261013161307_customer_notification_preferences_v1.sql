-- Customer notification channel preferences v1.
-- Adds customer-controlled Email / LINE preferences and enforces them at send time
-- for the unified pickup notification worker. Existing customers default to Email ON,
-- LINE OFF. At least one channel must remain enabled.

BEGIN;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS notification_email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_line_enabled boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND conname = 'user_profiles_notification_channel_required'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_notification_channel_required
      CHECK (notification_email_enabled OR notification_line_enabled);
  END IF;
END;
$$;

GRANT UPDATE (notification_email_enabled, notification_line_enabled)
  ON TABLE public.user_profiles TO authenticated;

COMMENT ON COLUMN public.user_profiles.notification_email_enabled IS
  'Customer preference for transactional/order notifications by email.';
COMMENT ON COLUMN public.user_profiles.notification_line_enabled IS
  'Customer preference for transactional/order notifications by LINE. Delivery also requires a linked LINE identity and JOKO Today OA friendship.';

CREATE OR REPLACE FUNCTION private.guard_customer_notification_preferences_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  c private.notification_control_v1%ROWTYPE;
BEGIN
  IF NOT coalesce(NEW.notification_email_enabled, true)
     AND coalesce(NEW.notification_line_enabled, false) THEN
    SELECT *
    INTO c
    FROM private.notification_control_v1
    WHERE id=true;

    IF c.line_context IS NULL
       OR c.line_destination IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM auth.identities i
         JOIN private.line_oa_relationships_v1 r
           ON r.line_user_id=i.provider_id
          AND r.provider_context=c.line_context
          AND r.destination=c.line_destination
         WHERE i.user_id=NEW.id
           AND i.provider='custom:line'
           AND i.provider_id=i.identity_data->>'sub'
           AND i.provider_id ~ '^U[0-9a-f]{32}$'
           AND r.friendship='friend'
       ) THEN
      RAISE EXCEPTION 'LINE-only notifications require a connected LINE account and JOKO Today friendship';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_customer_notification_preferences_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_customer_notification_preferences_v1
  ON public.user_profiles;

CREATE TRIGGER guard_customer_notification_preferences_v1
BEFORE INSERT OR UPDATE OF notification_email_enabled, notification_line_enabled
ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION private.guard_customer_notification_preferences_v1();

ALTER TABLE public.order_notification_events
  DROP CONSTRAINT order_notification_events_notification_type_check;

ALTER TABLE public.order_notification_events
  ADD CONSTRAINT order_notification_events_notification_type_check
  CHECK (notification_type IN (
    'customer_confirmation',
    'customer_confirmation_line',
    'admin_new_order',
    'customer_cancellation',
    'customer_cancellation_line',
    'payment_confirmation',
    'payment_confirmation_line',
    'pickup_reminder',
    'pickup_completed',
    'pickup_not_collected',
    'customer_receipt_email',
    'customer_receipt_line'
  ));

CREATE OR REPLACE FUNCTION private.notification_recipient_v1(p_customer uuid,p_channel text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  recipient text;
  c private.notification_control_v1%ROWTYPE;
  email_enabled boolean;
  line_enabled boolean;
BEGIN
  SELECT
    coalesce(notification_email_enabled, true),
    coalesce(notification_line_enabled, false)
  INTO email_enabled, line_enabled
  FROM public.user_profiles
  WHERE id = p_customer;

  IF p_channel='email' THEN
    IF NOT coalesce(email_enabled, true) THEN
      RETURN NULL;
    END IF;

    SELECT email
    INTO recipient
    FROM auth.users
    WHERE id=p_customer
      AND email_confirmed_at IS NOT NULL
      AND deleted_at IS NULL
      AND (banned_until IS NULL OR banned_until<now());
  ELSE
    IF NOT coalesce(line_enabled, false) THEN
      RETURN NULL;
    END IF;

    SELECT * INTO c FROM private.notification_control_v1 WHERE id=true;

    SELECT i.provider_id
    INTO recipient
    FROM auth.identities i
    JOIN auth.users u ON u.id=i.user_id
    JOIN private.line_oa_relationships_v1 r
      ON r.line_user_id=i.provider_id
     AND r.provider_context=c.line_context
     AND r.destination=c.line_destination
    WHERE i.user_id=p_customer
      AND i.provider='custom:line'
      AND i.provider_id=i.identity_data->>'sub'
      AND i.provider_id ~ '^U[0-9a-f]{32}$'
      AND r.friendship='friend'
      AND u.deleted_at IS NULL
      AND (u.banned_until IS NULL OR u.banned_until<now());
  END IF;

  RETURN nullif(btrim(recipient),'');
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_customer_notification_recipient_v1(
  p_customer_id uuid,
  p_channel text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF p_customer_id IS NULL OR p_channel NOT IN ('email','line') THEN
    RETURN NULL;
  END IF;
  RETURN private.notification_recipient_v1(p_customer_id, p_channel);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_customer_notification_recipient_v1(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_customer_notification_recipient_v1(uuid,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_order_notification(
  p_order_id uuid,
  p_notification_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_event public.order_notification_events%ROWTYPE;
BEGIN
  IF p_order_id IS NULL
     OR p_notification_type NOT IN (
       'customer_confirmation',
       'customer_confirmation_line',
       'admin_new_order',
       'customer_cancellation',
       'customer_cancellation_line',
       'payment_confirmation',
       'payment_confirmation_line',
       'customer_receipt_email',
       'customer_receipt_line'
     ) THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND COALESCE(o.purchase_type, 'online') = 'online'
      AND (
        (p_notification_type IN ('customer_cancellation','customer_cancellation_line') AND o.status = 'cancelled')
        OR (p_notification_type IN ('payment_confirmation','payment_confirmation_line') AND o.payment_status = 'paid')
        OR (p_notification_type IN ('customer_receipt_email','customer_receipt_line') AND o.status = 'completed')
        OR p_notification_type IN ('customer_confirmation','customer_confirmation_line','admin_new_order')
      )
  ) THEN
    RETURN jsonb_build_object('outcome', 'unavailable');
  END IF;

  SELECT *
  INTO v_event
  FROM public.order_notification_events
  WHERE order_id = p_order_id
    AND notification_type = p_notification_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'unavailable');
  END IF;

  IF v_event.status = 'sent' THEN
    RETURN jsonb_build_object(
      'outcome', 'already_sent',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  END IF;

  IF v_event.status = 'uncertain' THEN
    RETURN jsonb_build_object(
      'outcome', 'uncertain',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  END IF;

  IF v_event.status = 'processing'
     AND v_event.claimed_at IS NOT NULL
     AND v_event.claimed_at > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object(
      'outcome', 'processing',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  END IF;

  IF v_event.status = 'processing'
     AND v_event.first_attempt_at IS NOT NULL
     AND v_event.first_attempt_at <= now() - interval '23 hours' THEN
    UPDATE public.order_notification_events
    SET status = 'uncertain',
        updated_at = now(),
        last_error = COALESCE(last_error, 'Processing outcome exceeded provider idempotency window')
    WHERE id = v_event.id
    RETURNING * INTO v_event;

    RETURN jsonb_build_object(
      'outcome', 'uncertain',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  END IF;

  UPDATE public.order_notification_events
  SET status = 'processing',
      first_attempt_at = COALESCE(first_attempt_at, now()),
      claimed_at = now(),
      attempt_count = attempt_count + 1,
      updated_at = now(),
      last_error = NULL
  WHERE id = v_event.id
  RETURNING * INTO v_event;

  RETURN jsonb_build_object(
    'outcome', 'claimed',
    'event_id', v_event.id,
    'attempt_count', v_event.attempt_count,
    'language', v_event.language
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_notification(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_notification(uuid,text)
  TO service_role;

INSERT INTO public.cms_labels (key, text_en, text_th, text_zh)
VALUES
  (
    'profile.notifications_heading',
    'Notifications via',
    'รับการแจ้งเตือนผ่าน',
    '通知方式'
  ),
  (
    'profile.notifications_intro',
    'Choose how you would like JOKO to send important order updates. Please keep at least one channel selected.',
    'เลือกช่องทางที่คุณต้องการให้ JOKO ส่งข้อมูลสำคัญเกี่ยวกับคำสั่งซื้อ โปรดเลือกอย่างน้อยหนึ่งช่องทาง',
    '请选择 JOKO 向您发送重要订单更新的方式。请至少选择一种通知渠道。'
  ),
  (
    'profile.notifications_email',
    'Email',
    'อีเมล',
    '电子邮箱'
  ),
  (
    'profile.notifications_email_help',
    'Sent to your verified JOKO account email.',
    'ส่งไปยังอีเมลที่ยืนยันแล้วในบัญชี JOKO ของคุณ',
    '发送到您的 JOKO 账户已验证邮箱。'
  ),
  (
    'profile.notifications_line',
    'LINE',
    'LINE',
    'LINE'
  ),
  (
    'profile.notifications_line_help',
    'LINE notifications require a connected LINE account and JOKO Today added as a friend.',
    'การแจ้งเตือนทาง LINE ต้องเชื่อมต่อบัญชี LINE และเพิ่ม JOKO Today เป็นเพื่อน',
    '接收 LINE 通知需要关联 LINE 账号，并将 JOKO Today 添加为好友。'
  ),
  (
    'profile.notifications_line_pending',
    'You can select LINE now. Messages will start once your LINE account is connected and JOKO Today is added as a friend.',
    'คุณสามารถเลือก LINE ได้ตอนนี้ ข้อความจะเริ่มส่งเมื่อเชื่อมต่อบัญชี LINE และเพิ่ม JOKO Today เป็นเพื่อนแล้ว',
    '您现在可以选择 LINE。关联 LINE 账号并将 JOKO Today 添加为好友后，才会开始接收消息。'
  ),
  (
    'profile.notifications_types_heading',
    'These may include:',
    'การแจ้งเตือนอาจรวมถึง:',
    '通知可能包括：'
  ),
  (
    'profile.notifications_type_order',
    'Order confirmations and important order updates',
    'การยืนยันคำสั่งซื้อและข้อมูลสำคัญเกี่ยวกับคำสั่งซื้อ',
    '订单确认及重要订单更新'
  ),
  (
    'profile.notifications_type_payment',
    'Payment confirmations and important payment updates',
    'การยืนยันและข้อมูลอัปเดตสำคัญเกี่ยวกับการชำระเงิน',
    '付款确认及重要付款更新'
  ),
  (
    'profile.notifications_type_pickup',
    'Pickup reminders and pickup-time updates',
    'การแจ้งเตือนรับสินค้าและข้อมูลอัปเดตเกี่ยวกับเวลารับสินค้า',
    '取货提醒及取货时间更新'
  ),
  (
    'profile.notifications_type_receipt',
    'Pickup confirmation, thank-you messages and receipts',
    'การยืนยันรับสินค้า ข้อความขอบคุณ และใบเสร็จ',
    '取货确认、感谢消息及收据'
  ),
  (
    'profile.notifications_type_missed',
    'Missed-pickup or follow-up notices when needed',
    'การแจ้งเตือนเมื่อยังไม่ได้รับสินค้า หรือข้อความติดตามเมื่อจำเป็น',
    '未取货提醒或必要的后续通知'
  ),
  (
    'profile.notifications_required_error',
    'Please select at least one notification channel.',
    'กรุณาเลือกช่องทางการแจ้งเตือนอย่างน้อยหนึ่งช่องทาง',
    '请至少选择一种通知方式。'
  ),
  (
    'profile.notifications_line_only_error',
    'To use LINE as your only notification channel, connect LINE and add JOKO Today as a friend first.',
    'หากต้องการใช้ LINE เป็นช่องทางการแจ้งเตือนเพียงช่องทางเดียว กรุณาเชื่อมต่อ LINE และเพิ่ม JOKO Today เป็นเพื่อนก่อน',
    '如需仅通过 LINE 接收通知，请先关联 LINE 账号并将 JOKO Today 添加为好友。'
  )
ON CONFLICT (key) DO UPDATE
SET
  text_en = EXCLUDED.text_en,
  text_th = EXCLUDED.text_th,
  text_zh = EXCLUDED.text_zh,
  updated_at = now();

COMMIT;
