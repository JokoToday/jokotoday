-- Shared JOKO account notification inbox for order and test-baker activity.
-- Order notices are created only after an external provider accepts a delivery.
-- Test-baker workflows can publish in-app notices through the service-only RPC.

BEGIN;

GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE public.account_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('orders', 'test_baker')),
  event_key text NOT NULL CHECK (length(event_key) BETWEEN 1 AND 200),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  href text,
  delivered_channels text[] NOT NULL DEFAULT '{}'
    CHECK (delivered_channels <@ ARRAY['email', 'line']::text[]),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (user_id, category, event_key),
  CHECK (href IS NULL OR (left(href, 1) = '/' AND left(href, 2) <> '//'))
);

CREATE INDEX account_notifications_user_created_idx
  ON public.account_notifications (user_id, created_at DESC, id DESC);
CREATE INDEX account_notifications_user_unread_idx
  ON public.account_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.account_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, user_id, category, event_key, content, href, delivered_channels, created_at, read_at)
  ON public.account_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.account_notifications TO authenticated;
GRANT ALL ON public.account_notifications TO service_role;

CREATE POLICY account_notifications_select_own_v1
  ON public.account_notifications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY account_notifications_update_own_v1
  ON public.account_notifications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE FUNCTION private.record_order_account_notification_v1(
  p_event_id uuid,
  p_channel text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e public.order_notification_events%ROWTYPE;
  o public.orders%ROWTYPE;
  title_en text;
  title_th text;
  title_zh text;
  body_en text;
  body_th text;
  body_zh text;
  order_ref text;
  kind text;
  notice_content jsonb;
BEGIN
  IF p_channel NOT IN ('email', 'line') OR p_channel IS NULL THEN
    RAISE EXCEPTION 'Invalid notification channel';
  END IF;

  SELECT * INTO e
  FROM public.order_notification_events
  WHERE id = p_event_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF e.notification_type NOT IN (
    'customer_confirmation', 'customer_confirmation_line',
    'customer_cancellation', 'customer_cancellation_line',
    'payment_confirmation', 'payment_confirmation_line',
    'customer_receipt_email', 'customer_receipt_line',
    'pickup_reminder', 'pickup_completed', 'pickup_not_collected'
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO o FROM public.orders WHERE id = e.order_id;
  IF NOT FOUND OR o.customer_id IS NULL THEN RETURN; END IF;

  kind := CASE
    WHEN e.notification_type IN ('customer_confirmation', 'customer_confirmation_line') THEN 'confirmed'
    WHEN e.notification_type IN ('customer_cancellation', 'customer_cancellation_line') THEN 'cancelled'
    WHEN e.notification_type IN ('payment_confirmation', 'payment_confirmation_line') THEN 'paid'
    WHEN e.notification_type IN ('customer_receipt_email', 'customer_receipt_line') THEN 'receipt'
    ELSE e.notification_type
  END;
  order_ref := coalesce(o.order_number::text, left(o.id::text, 8));

  CASE kind
    WHEN 'confirmed' THEN
      title_en := 'Order confirmed'; title_th := 'ยืนยันคำสั่งซื้อแล้ว'; title_zh := '订单已确认';
      body_en := format('Your order #%s is confirmed. View your order for details.', order_ref);
      body_th := format('ยืนยันคำสั่งซื้อ #%s แล้ว ดูรายละเอียดได้ในคำสั่งซื้อของคุณ', order_ref);
      body_zh := format('订单 #%s 已确认。请在订单页面查看详情。', order_ref);
    WHEN 'cancelled' THEN
      title_en := 'Order cancelled'; title_th := 'ยกเลิกคำสั่งซื้อแล้ว'; title_zh := '订单已取消';
      body_en := format('Order #%s has been cancelled.', order_ref);
      body_th := format('คำสั่งซื้อ #%s ถูกยกเลิกแล้ว', order_ref);
      body_zh := format('订单 #%s 已取消。', order_ref);
    WHEN 'paid' THEN
      title_en := 'Payment received'; title_th := 'ได้รับชำระเงินแล้ว'; title_zh := '已收到付款';
      body_en := format('Payment for order #%s was confirmed.', order_ref);
      body_th := format('ยืนยันการชำระเงินสำหรับคำสั่งซื้อ #%s แล้ว', order_ref);
      body_zh := format('订单 #%s 的付款已确认。', order_ref);
    WHEN 'receipt' THEN
      title_en := 'Pickup receipt ready'; title_th := 'ใบรับสินค้าพร้อมแล้ว'; title_zh := '取货凭证已准备好';
      body_en := format('Your pickup receipt for order #%s is ready.', order_ref);
      body_th := format('ใบรับสินค้าสำหรับคำสั่งซื้อ #%s พร้อมแล้ว', order_ref);
      body_zh := format('订单 #%s 的取货凭证已准备好。', order_ref);
    WHEN 'pickup_reminder' THEN
      title_en := 'Pickup reminder'; title_th := 'แจ้งเตือนการรับสินค้า'; title_zh := '取货提醒';
      body_en := format('Your pickup window for order #%s is coming up.', order_ref);
      body_th := format('ใกล้ถึงเวลารับสินค้าสำหรับคำสั่งซื้อ #%s แล้ว', order_ref);
      body_zh := format('订单 #%s 即将进入取货时间。', order_ref);
    WHEN 'pickup_completed' THEN
      title_en := 'Order picked up'; title_th := 'รับสินค้าแล้ว'; title_zh := '订单已取货';
      body_en := format('Order #%s is marked as picked up. Thank you!', order_ref);
      body_th := format('ทำเครื่องหมายว่ารับคำสั่งซื้อ #%s แล้ว ขอบคุณค่ะ/ครับ', order_ref);
      body_zh := format('订单 #%s 已标记为取货。谢谢！', order_ref);
    ELSE
      title_en := 'Pickup window ended'; title_th := 'สิ้นสุดเวลารับสินค้าแล้ว'; title_zh := '取货时间已结束';
      body_en := format('The pickup window for order #%s has ended. Please contact JOKO TODAY if you need help.', order_ref);
      body_th := format('เวลารับสินค้าสำหรับคำสั่งซื้อ #%s สิ้นสุดแล้ว หากต้องการความช่วยเหลือ โปรดติดต่อ JOKO TODAY', order_ref);
      body_zh := format('订单 #%s 的取货时间已结束。如需帮助，请联系 JOKO TODAY。', order_ref);
  END CASE;

  notice_content := jsonb_build_object(
    'en', jsonb_build_object('title', title_en, 'body', body_en),
    'th', jsonb_build_object('title', title_th, 'body', body_th),
    'zh', jsonb_build_object('title', title_zh, 'body', body_zh)
  );

  INSERT INTO public.account_notifications (
    user_id, category, event_key, content, href, delivered_channels
  ) VALUES (
    o.customer_id, 'orders', 'order_notification:' || e.id::text,
    notice_content, '/my-orders', ARRAY[p_channel]
  )
  ON CONFLICT (user_id, category, event_key) DO UPDATE
    SET delivered_channels = (
      SELECT coalesce(array_agg(DISTINCT channel ORDER BY channel), '{}')
      FROM unnest(account_notifications.delivered_channels || EXCLUDED.delivered_channels) AS expanded(channel)
    );
END;
$$;

REVOKE ALL ON FUNCTION private.record_order_account_notification_v1(uuid, text)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.capture_legacy_order_account_notification_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_channel text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'sent' OR OLD.status IS NOT DISTINCT FROM 'sent' THEN
    RETURN NEW;
  END IF;
  v_channel := CASE WHEN NEW.notification_type LIKE '%_line' THEN 'line' ELSE 'email' END;
  PERFORM private.record_order_account_notification_v1(NEW.id, v_channel);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.capture_legacy_order_account_notification_v1()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER capture_legacy_order_account_notification_v1
AFTER UPDATE OF status ON public.order_notification_events
FOR EACH ROW
WHEN (NEW.status = 'sent' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION private.capture_legacy_order_account_notification_v1();

CREATE FUNCTION private.capture_unified_order_account_notification_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM private.record_order_account_notification_v1(
      NEW.event_id,
      NEW.channel
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.capture_unified_order_account_notification_v1()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER capture_unified_order_account_notification_v1
AFTER UPDATE OF status ON public.notification_deliveries
FOR EACH ROW
WHEN (NEW.status = 'sent' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION private.capture_unified_order_account_notification_v1();

CREATE FUNCTION private.publish_test_baker_account_notification_v1(
  p_user_id uuid,
  p_event_key text,
  p_content jsonb,
  p_href text DEFAULT '/diy'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  language_code text;
  translated jsonb;
  notice_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_event_key IS NULL OR length(p_event_key) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Invalid test-baker notification key';
  END IF;
  IF p_href IS NOT NULL AND (left(p_href, 1) <> '/' OR left(p_href, 2) = '//') THEN
    RAISE EXCEPTION 'Notification destination must be an internal path';
  END IF;
  IF jsonb_typeof(p_content) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Notification content must be an object';
  END IF;

  FOREACH language_code IN ARRAY ARRAY['en', 'th', 'zh'] LOOP
    translated := p_content -> language_code;
    IF jsonb_typeof(translated) IS DISTINCT FROM 'object'
       OR jsonb_typeof(translated -> 'title') IS DISTINCT FROM 'string'
       OR jsonb_typeof(translated -> 'body') IS DISTINCT FROM 'string'
       OR length(translated ->> 'title') NOT BETWEEN 1 AND 200
       OR length(translated ->> 'body') NOT BETWEEN 1 AND 2000 THEN
      RAISE EXCEPTION 'Missing or invalid notification copy for language %', language_code;
    END IF;
  END LOOP;

  INSERT INTO public.account_notifications (user_id, category, event_key, content, href)
  VALUES (p_user_id, 'test_baker', p_event_key, p_content, p_href)
  ON CONFLICT (user_id, category, event_key) DO NOTHING
  RETURNING id INTO notice_id;

  IF notice_id IS NULL THEN
    SELECT id INTO notice_id
    FROM public.account_notifications
    WHERE user_id = p_user_id AND category = 'test_baker' AND event_key = p_event_key;
  END IF;
  RETURN notice_id;
END;
$$;

REVOKE ALL ON FUNCTION private.publish_test_baker_account_notification_v1(uuid, text, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.publish_test_baker_account_notification_v1(uuid, text, jsonb, text)
  TO service_role;

COMMIT;
