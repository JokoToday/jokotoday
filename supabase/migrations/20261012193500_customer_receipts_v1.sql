-- JOKO TODAY Customer Receipts v1
-- Creates an immutable receipt snapshot when a pickup handover is completed.
-- The snapshot stays on the order so customer/staff history can always re-render
-- the same receipt. Delivery is queued separately through the notification outbox.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS receipt_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_snapshot jsonb;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_receipt_snapshot_object;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_receipt_snapshot_object
  CHECK (receipt_snapshot IS NULL OR jsonb_typeof(receipt_snapshot) = 'object');

COMMENT ON COLUMN public.orders.receipt_issued_at IS
'Timestamp when the immutable customer receipt snapshot was first issued after pickup completion.';

COMMENT ON COLUMN public.orders.receipt_snapshot IS
'Immutable customer receipt data captured at pickup completion for reprint/history and notification delivery.';

ALTER TABLE public.order_notification_events
  DROP CONSTRAINT IF EXISTS order_notification_events_notification_type_check;

ALTER TABLE public.order_notification_events
  ADD CONSTRAINT order_notification_events_notification_type_check
  CHECK (notification_type IN (
    'customer_confirmation',
    'admin_new_order',
    'customer_cancellation',
    'payment_confirmation',
    'customer_receipt'
  ));

CREATE OR REPLACE FUNCTION private.issue_customer_receipt_on_handover_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $receipt$
DECLARE
  v_order public.orders%ROWTYPE;
  v_location public.cms_pickup_locations%ROWTYPE;
  v_profile public.user_profiles%ROWTYPE;
  v_issued_at timestamptz := COALESCE(NEW.completed_at, now());
  v_language text := 'en';
  v_snapshot jsonb;
BEGIN
  IF TG_OP <> 'UPDATE'
     OR OLD.status IS NOT DISTINCT FROM NEW.status
     OR NEW.status NOT IN ('confirmed', 'bypassed') THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found while issuing receipt';
  END IF;

  -- First successful completion owns the receipt snapshot. Replays never
  -- rewrite historical receipt data.
  IF v_order.receipt_snapshot IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_order.customer_id IS NOT NULL THEN
    SELECT *
    INTO v_profile
    FROM public.user_profiles
    WHERE id = v_order.customer_id;

    IF FOUND AND v_profile.preferred_language IN ('en', 'th', 'zh') THEN
      v_language := v_profile.preferred_language;
    END IF;
  END IF;

  IF v_order.pickup_location_id IS NOT NULL THEN
    SELECT *
    INTO v_location
    FROM public.cms_pickup_locations
    WHERE id = v_order.pickup_location_id;
  END IF;

  v_snapshot := jsonb_build_object(
    'version', 1,
    'receipt_number', 'R-' || v_order.order_number,
    'issued_at', v_issued_at,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'customer', jsonb_build_object(
      'id', v_order.customer_id,
      'name', v_order.customer_name,
      'email', v_order.customer_email,
      'short_code', CASE WHEN v_profile.id IS NULL THEN NULL ELSE v_profile.short_code END
    ),
    'items', COALESCE(v_order.order_items, '[]'::jsonb),
    'amounts', jsonb_build_object(
      'gross', COALESCE(v_order.total_amount, 0),
      'loyalty_discount', COALESCE(v_order.loyalty_discount_amount, 0),
      'paid', COALESCE(
        v_order.amount_paid,
        GREATEST(0, COALESCE(v_order.total_amount, 0) - COALESCE(v_order.loyalty_discount_amount, 0))
      ),
      'currency', 'THB'
    ),
    'payment', jsonb_build_object(
      'status', v_order.payment_status,
      'method', v_order.payment_method
    ),
    'ordered_at', v_order.created_at,
    'pickup_date', v_order.pickup_date,
    'picked_up_at', COALESCE(v_order.picked_up_at, v_issued_at),
    'pickup_location', CASE
      WHEN v_location.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', v_location.id,
        'name_en', v_location.name_en,
        'name_th', v_location.name_th,
        'name_zh', v_location.name_zh,
        'maps_url', v_location.maps_url
      )
    END,
    'loyalty_points_earned', COALESCE(v_order.loyalty_points_earned, 0),
    'handover', jsonb_build_object(
      'id', NEW.id,
      'confirmation_mode', CASE WHEN NEW.status = 'confirmed' THEN 'customer_qr' ELSE 'staff_bypass' END
    ),
    'catalog_url', 'https://joko.today/products'
  );

  UPDATE public.orders
  SET receipt_issued_at = v_issued_at,
      receipt_snapshot = v_snapshot,
      updated_at = now()
  WHERE id = v_order.id
    AND receipt_snapshot IS NULL;

  INSERT INTO public.order_notification_events (
    order_id,
    notification_type,
    language
  )
  VALUES (
    v_order.id,
    'customer_receipt',
    v_language
  )
  ON CONFLICT (order_id, notification_type) DO NOTHING;

  RETURN NEW;
END;
$receipt$;

REVOKE ALL ON FUNCTION private.issue_customer_receipt_on_handover_v1() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS issue_customer_receipt_on_handover_v1
  ON public.pickup_handover_sessions;

CREATE TRIGGER issue_customer_receipt_on_handover_v1
AFTER UPDATE OF status, completed_at
ON public.pickup_handover_sessions
FOR EACH ROW
EXECUTE FUNCTION private.issue_customer_receipt_on_handover_v1();

-- Receipt wording is ordinary CMS content. Admin can edit EN / TH / ZH using
-- the existing Labels editor. DO NOTHING preserves any copy already customized.
INSERT INTO public.cms_labels (key, text_en, text_th, text_zh)
VALUES
  ('my_orders_page.print_receipt', 'Print receipt', 'พิมพ์ใบเสร็จ', '打印收据'),
  ('my_orders_page.receipt_title', 'Receipt', 'ใบเสร็จรับเงิน', '收据'),
  ('my_orders_page.receipt_number', 'Receipt', 'เลขที่ใบเสร็จ', '收据编号'),
  ('my_orders_page.receipt_disclaimer', 'This receipt confirms payment and collection. It is not a tax invoice.', 'ใบเสร็จนี้ยืนยันการชำระเงินและการรับสินค้า เอกสารนี้ไม่ใช่ใบกำกับภาษี', '此收据确认付款及取货。本文件不是税务发票。'),
  ('my_orders_page.receipt_customer', 'Customer', 'ลูกค้า', '客户'),
  ('my_orders_page.receipt_order', 'Order', 'คำสั่งซื้อ', '订单'),
  ('my_orders_page.receipt_ordered', 'Ordered', 'วันที่สั่งซื้อ', '下单日期'),
  ('my_orders_page.receipt_pickup', 'Pickup', 'รับสินค้า', '取货'),
  ('my_orders_page.receipt_picked_up', 'Collected', 'รับสินค้าแล้ว', '已取货'),
  ('my_orders_page.receipt_location', 'Location', 'สถานที่รับสินค้า', '取货地点'),
  ('my_orders_page.receipt_status', 'Order status', 'สถานะคำสั่งซื้อ', '订单状态'),
  ('my_orders_page.receipt_status_collected', 'Collected', 'รับสินค้าแล้ว', '已取货'),
  ('my_orders_page.receipt_payment_paid', 'Paid', 'ชำระแล้ว', '已付款'),
  ('my_orders_page.receipt_items', 'Items', 'รายการสินค้า', '商品'),
  ('my_orders_page.receipt_quantity', 'Qty', 'จำนวน', '数量'),
  ('my_orders_page.receipt_unit_price', 'Unit price', 'ราคาต่อชิ้น', '单价'),
  ('my_orders_page.receipt_gross', 'Gross total', 'ยอดก่อนส่วนลด', '折扣前金额'),
  ('my_orders_page.receipt_discount', 'Loyalty discount', 'ส่วนลดสมาชิก', '会员优惠'),
  ('my_orders_page.receipt_total_paid', 'Total paid', 'ยอดชำระจริง', '实付金额'),
  ('my_orders_page.receipt_payment', 'Payment', 'การชำระเงิน', '付款'),
  ('my_orders_page.receipt_points', 'Points earned', 'แต้มที่ได้รับ', '获得积分'),
  ('my_orders_page.receipt_footer', 'THANK YOU FOR YOUR ORDER.\nSELECTED GOODNESS. FOR A BRIGHTER TODAY.', 'ขอบคุณสำหรับคำสั่งซื้อของคุณ\nSELECTED GOODNESS. FOR A BRIGHTER TODAY.', '感谢您的订购。\nSELECTED GOODNESS. FOR A BRIGHTER TODAY.'),
  ('my_orders_page.receipt_next_order', 'Your next order', 'สั่งครั้งถัดไป', '下一次订购')
ON CONFLICT (key) DO NOTHING;

COMMIT;
