-- Customer Receipt & Pickup Completion v1
-- Adds customer-confirmed pickup handoff, immutable receipt snapshots,
-- receipt notification event types, and order-scoped pickup codes.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_code text;

UPDATE public.orders
SET pickup_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
WHERE pickup_code IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN pickup_code SET DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  ALTER COLUMN pickup_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_pickup_code_key
  ON public.orders (pickup_code);

COMMENT ON COLUMN public.orders.pickup_code IS
'Order-scoped non-login identifier rendered on order confirmations for staff pickup lookup.';
COMMENT ON COLUMN public.orders.customer_received_at IS
'Timestamp when the customer explicitly confirmed receipt after staff handover.';

CREATE TABLE IF NOT EXISTS public.pickup_handoff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'confirmed', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pickup_handoff_sessions_order_idx
  ON public.pickup_handoff_sessions (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pickup_handoff_sessions_customer_idx
  ON public.pickup_handoff_sessions (customer_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS pickup_handoff_sessions_one_active_per_order
  ON public.pickup_handoff_sessions (order_id)
  WHERE status = 'active';

ALTER TABLE public.pickup_handoff_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pickup_handoff_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pickup_handoff_sessions TO service_role;

COMMENT ON TABLE public.pickup_handoff_sessions IS
'One-time customer receipt-confirmation handoffs. Only SHA-256 token hashes are persisted.';

CREATE TABLE IF NOT EXISTS public.order_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  receipt_number text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  document_version integer NOT NULL DEFAULT 1 CHECK (document_version > 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_receipts_customer_issued_idx
  ON public.order_receipts (customer_id, issued_at DESC);

ALTER TABLE public.order_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can read own order receipts" ON public.order_receipts;
CREATE POLICY "Customers can read own order receipts"
  ON public.order_receipts
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = customer_id);

DROP POLICY IF EXISTS "Staff can read order receipts" ON public.order_receipts;
CREATE POLICY "Staff can read order receipts"
  ON public.order_receipts
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

REVOKE ALL ON public.order_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_receipts TO authenticated;
GRANT ALL ON public.order_receipts TO service_role;

COMMENT ON TABLE public.order_receipts IS
'Immutable customer receipt snapshots issued only after customer receipt confirmation.';

ALTER TABLE public.order_notification_events
  DROP CONSTRAINT IF EXISTS order_notification_events_notification_type_check;

ALTER TABLE public.order_notification_events
  ADD CONSTRAINT order_notification_events_notification_type_check
  CHECK (notification_type IN (
    'customer_confirmation',
    'admin_new_order',
    'customer_cancellation',
    'payment_confirmation',
    'customer_receipt_email',
    'customer_receipt_line'
  ));

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
       'admin_new_order',
       'customer_cancellation',
       'payment_confirmation',
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
        (p_notification_type = 'customer_cancellation' AND o.status = 'cancelled')
        OR (p_notification_type = 'payment_confirmation' AND o.payment_status = 'paid')
        OR (p_notification_type IN ('customer_receipt_email', 'customer_receipt_line') AND o.status = 'completed')
        OR p_notification_type IN ('customer_confirmation', 'admin_new_order')
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

CREATE OR REPLACE FUNCTION public.complete_order_customer_receipt(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handoff public.pickup_handoff_sessions%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  IF p_token_hash IS NULL OR length(btrim(p_token_hash)) < 32 THEN
    RAISE EXCEPTION 'Invalid receipt confirmation token';
  END IF;

  SELECT *
  INTO v_handoff
  FROM public.pickup_handoff_sessions
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt confirmation not found';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = v_handoff.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_handoff.status = 'confirmed' THEN
    RETURN jsonb_build_object(
      'order_id', v_order.id,
      'customer_id', v_order.customer_id,
      'order_number', v_order.order_number,
      'customer_received_at', v_order.customer_received_at,
      'already_confirmed', true
    );
  END IF;

  IF v_handoff.status <> 'active' THEN
    RAISE EXCEPTION 'Receipt confirmation is no longer active';
  END IF;

  IF v_handoff.expires_at <= now() THEN
    UPDATE public.pickup_handoff_sessions
    SET status = 'expired', updated_at = now()
    WHERE id = v_handoff.id;
    RAISE EXCEPTION 'Receipt confirmation has expired';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled orders cannot be completed';
  END IF;

  IF COALESCE(v_order.payment_status, 'unpaid') <> 'paid' THEN
    RAISE EXCEPTION 'Payment must be complete before customer receipt confirmation';
  END IF;

  IF v_order.status NOT IN ('picked_up', 'completed') THEN
    RAISE EXCEPTION 'Staff handover must be confirmed first';
  END IF;

  UPDATE public.orders
  SET
    status = 'completed',
    customer_received_at = COALESCE(customer_received_at, now()),
    updated_at = now()
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  UPDATE public.pickup_handoff_sessions
  SET
    status = 'confirmed',
    confirmed_at = COALESCE(confirmed_at, v_order.customer_received_at, now()),
    updated_at = now()
  WHERE id = v_handoff.id;

  UPDATE public.pickup_handoff_sessions
  SET status = 'cancelled', updated_at = now()
  WHERE order_id = v_order.id
    AND id <> v_handoff.id
    AND status = 'active';

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'customer_id', v_order.customer_id,
    'order_number', v_order.order_number,
    'customer_received_at', v_order.customer_received_at,
    'already_confirmed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_order_customer_receipt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_order_customer_receipt(text) TO service_role;

COMMENT ON FUNCTION public.complete_order_customer_receipt(text) IS
'Service-role-only atomic transition from staff handover (picked_up) to customer-confirmed completed.';

CREATE OR REPLACE FUNCTION public.staff_lookup_pickup_code(p_pickup_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE pickup_code = upper(btrim(p_pickup_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'customer_id', v_order.customer_id,
    'customer_short_code', (
      SELECT up.short_code
      FROM public.user_profiles up
      WHERE up.id = v_order.customer_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_lookup_pickup_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_lookup_pickup_code(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.staff_lookup_pickup_code(text) IS
'Staff/admin-only lookup for the non-login order pickup code printed on order confirmations.';

INSERT INTO public.cms_settings (setting_key, value)
VALUES ('receipt_next_order_url', '/products?from=receipt')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.cms_labels (key, text_en, text_th, text_zh)
VALUES
  ('receipt_document.title', 'Receipt', 'ใบเสร็จรับเงิน', '收据'),
  ('receipt_document.receipt_number', 'Receipt', 'เลขที่ใบเสร็จ', '收据编号'),
  ('receipt_document.issued', 'Issued', 'ออกเมื่อ', '开具时间'),
  ('receipt_document.customer', 'Customer', 'ลูกค้า', '客户'),
  ('receipt_document.order', 'Order', 'คำสั่งซื้อ', '订单'),
  ('receipt_document.ordered', 'Ordered', 'วันที่สั่งซื้อ', '下单日期'),
  ('receipt_document.pickup', 'Scheduled pickup', 'วันรับสินค้าที่กำหนด', '计划取货'),
  ('receipt_document.picked_up', 'Staff handover', 'เวลาส่งมอบโดยพนักงาน', '员工交付'),
  ('receipt_document.received', 'Customer confirmed receipt', 'ลูกค้ายืนยันรับสินค้า', '客户确认收货'),
  ('receipt_document.location', 'Pickup location', 'สถานที่รับสินค้า', '取货地点'),
  ('receipt_document.status', 'Status', 'สถานะ', '状态'),
  ('receipt_document.payment', 'Payment', 'การชำระเงิน', '付款'),
  ('receipt_document.payment_paid', 'Paid · ฿{{amount}} · {{method}}', 'ชำระแล้ว · ฿{{amount}} · {{method}}', '已付款 · ฿{{amount}} · {{method}}'),
  ('receipt_document.status_completed', 'Completed', 'เสร็จสิ้น', '已完成'),
  ('receipt_document.items', 'Items', 'รายการสินค้า', '商品'),
  ('receipt_document.quantity', 'Qty', 'จำนวน', '数量'),
  ('receipt_document.unit_price', 'Unit price', 'ราคาต่อชิ้น', '单价'),
  ('receipt_document.subtotal', 'Subtotal', 'ยอดก่อนส่วนลด', '小计'),
  ('receipt_document.discount', 'Discount', 'ส่วนลด', '折扣'),
  ('receipt_document.total_paid', 'Total paid', 'ยอดชำระแล้ว', '实付金额'),
  ('receipt_document.points_earned', 'Points earned', 'แต้มที่ได้รับ', '获得积分'),
  ('receipt_document.disclaimer', 'This receipt records payment and product receipt confirmation. It is not a tax invoice.', 'ใบเสร็จนี้บันทึกการชำระเงินและการยืนยันรับสินค้า ไม่ใช่ใบกำกับภาษี', '本收据记录付款及收货确认，并非税务发票。'),
  ('receipt_document.footer', 'THANK YOU FOR CHOOSING JOKO TODAY.', 'ขอบคุณที่เลือก JOKO TODAY', '感谢您选择 JOKO TODAY。'),
  ('receipt_document.next_order', 'Your next order', 'สั่งครั้งถัดไป', '再次订购'),
  ('receipt_document.print', 'Print receipt', 'พิมพ์ใบเสร็จ', '打印收据'),
  ('receipt_email.subject', 'Your JOKO TODAY receipt', 'ใบเสร็จ JOKO TODAY ของคุณ', '您的 JOKO TODAY 收据'),
  ('receipt_email.heading', 'Thank you — your receipt is ready', 'ขอบคุณ — ใบเสร็จของคุณพร้อมแล้ว', '谢谢 — 您的收据已准备好'),
  ('receipt_email.intro', 'Your pickup is complete. We have attached the receipt details to your order history.', 'การรับสินค้าของคุณเสร็จสมบูรณ์แล้ว เราได้บันทึกรายละเอียดใบเสร็จไว้ในประวัติคำสั่งซื้อของคุณ', '您的取货已完成。收据详情已保存到您的订单记录中。'),
  ('receipt_email.view_receipt', 'View / print receipt', 'ดู / พิมพ์ใบเสร็จ', '查看 / 打印收据'),
  ('receipt_email.footer', 'Thank you for choosing JOKO TODAY.', 'ขอบคุณที่เลือก JOKO TODAY', '感谢您选择 JOKO TODAY。'),
  ('receipt_line.title', 'Your JOKO TODAY receipt is ready', 'ใบเสร็จ JOKO TODAY ของคุณพร้อมแล้ว', '您的 JOKO TODAY 收据已准备好'),
  ('receipt_line.body', 'Thank you! Your pickup is complete and your receipt is saved in My Orders.', 'ขอบคุณ! การรับสินค้าของคุณเสร็จสมบูรณ์ และใบเสร็จถูกบันทึกไว้ใน My Orders แล้ว', '谢谢！您的取货已完成，收据已保存到“我的订单”。'),
  ('receipt_line.view_receipt', 'View receipt', 'ดูใบเสร็จ', '查看收据'),
  ('pickup_receipt.confirm_title', 'Confirm you received your products', 'ยืนยันว่าคุณได้รับสินค้าแล้ว', '确认您已收到商品'),
  ('pickup_receipt.confirm_intro', 'Please check your JOKO order below. Confirm only after the products have been handed to you.', 'กรุณาตรวจสอบคำสั่งซื้อ JOKO ด้านล่าง และยืนยันหลังจากได้รับสินค้าแล้วเท่านั้น', '请核对下方的 JOKO 订单，仅在商品已交付给您后确认。'),
  ('pickup_receipt.items', 'Your products', 'สินค้าของคุณ', '您的商品'),
  ('pickup_receipt.total_paid', 'Total paid', 'ยอดชำระแล้ว', '实付金额'),
  ('pickup_receipt.handover', 'Staff handover', 'พนักงานส่งมอบ', '员工交付'),
  ('pickup_receipt.confirm_button', 'Yes, I received everything', 'ใช่ ฉันได้รับสินค้าครบแล้ว', '是的，我已全部收到'),
  ('pickup_receipt.complete_title', 'All done. Thank you!', 'เรียบร้อยแล้ว ขอบคุณ!', '已完成，谢谢！'),
  ('pickup_receipt.complete_body', 'Your receipt is now saved with this order in My Orders.', 'ใบเสร็จของคุณถูกบันทึกไว้กับคำสั่งซื้อนี้ใน My Orders แล้ว', '您的收据现已保存到“我的订单”中的此订单。'),
  ('order_confirmation.pickup_qr_title', 'Pickup QR', 'QR สำหรับรับสินค้า', '取货二维码'),
  ('order_confirmation.pickup_qr_help', 'Show this QR to JOKO staff when collecting your order.', 'แสดง QR นี้ให้พนักงาน JOKO เมื่อต้องการรับสินค้า', '取货时请向 JOKO 员工出示此二维码。')
ON CONFLICT (key) DO NOTHING;
