/*
  # Add loyalty_points_earned to orders table + CMS labels

  ## Summary
  - Adds `loyalty_points_earned` integer column to the `orders` table
    so each order records how many loyalty points the customer received.
  - Inserts CMS labels for loyalty points display in EN, TH, ZH.

  ## Schema Changes
  - orders.loyalty_points_earned (integer, default 0)

  ## New CMS Labels (namespace: my_orders_page)
  - my_orders_page.loyalty_points_earned — label shown in order detail
  - my_orders_page.current_orders — section heading for active orders
  - my_orders_page.past_orders — section heading for completed/cancelled
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'loyalty_points_earned'
  ) THEN
    ALTER TABLE orders ADD COLUMN loyalty_points_earned integer DEFAULT 0;
  END IF;
END $$;

INSERT INTO cms_labels (key, text_en, text_th, text_zh) VALUES
  ('my_orders_page.loyalty_points_earned', 'Points Earned',    'แต้มที่ได้รับ',     '获得积分'),
  ('my_orders_page.current_orders',        'Current Orders',   'คำสั่งซื้อปัจจุบัน', '当前订单'),
  ('my_orders_page.past_orders',           'Past Orders',      'คำสั่งซื้อเก่า',    '历史订单'),
  ('my_orders_page.loyalty_points_total',  'Loyalty Points',   'แต้มสะสม',          '积分')
ON CONFLICT (key) DO UPDATE SET
  text_en = EXCLUDED.text_en,
  text_th = EXCLUDED.text_th,
  text_zh = EXCLUDED.text_zh;
