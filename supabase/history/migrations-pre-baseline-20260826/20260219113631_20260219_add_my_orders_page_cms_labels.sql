/*
  # Add CMS Labels for My Orders Page

  ## Summary
  Inserts all required CMS label keys under the `my_orders_page` namespace
  in English, Thai, and Simplified Chinese.

  ## New Labels
  - my_orders_page.my_orders_title — Page heading
  - my_orders_page.sort_label — Sort dropdown label
  - my_orders_page.sort_newest_oldest — Sort option
  - my_orders_page.sort_oldest_newest — Sort option
  - my_orders_page.sort_price_low_high — Sort option
  - my_orders_page.sort_price_high_low — Sort option
  - my_orders_page.order_number — "Order #" label
  - my_orders_page.total — Total label
  - my_orders_page.subtotal — Subtotal label
  - my_orders_page.discount — Discount label
  - my_orders_page.in_store_order — Badge label
  - my_orders_page.online_order — Badge label
  - my_orders_page.quantity — Quantity label
  - my_orders_page.unit_price — Unit price label
  - my_orders_page.line_total — Line total label
  - my_orders_page.no_orders_message — Empty state message
*/

INSERT INTO cms_labels (key, text_en, text_th, text_zh) VALUES
  ('my_orders_page.my_orders_title',      'My Orders',              'คำสั่งซื้อของฉัน',          '我的订单'),
  ('my_orders_page.sort_label',           'Sort by',                'เรียงตาม',                   '排序方式'),
  ('my_orders_page.sort_newest_oldest',   'Newest to Oldest',       'ใหม่ล่าสุด → เก่าสุด',      '最新到最早'),
  ('my_orders_page.sort_oldest_newest',   'Oldest to Newest',       'เก่าสุด → ใหม่ล่าสุด',      '最早到最新'),
  ('my_orders_page.sort_price_low_high',  'Price: Low to High',     'ราคา: ต่ำไปสูง',             '价格：从低到高'),
  ('my_orders_page.sort_price_high_low',  'Price: High to Low',     'ราคา: สูงไปต่ำ',             '价格：从高到低'),
  ('my_orders_page.order_number',         'Order',                  'คำสั่งซื้อ',                 '订单'),
  ('my_orders_page.total',                'Total',                  'ยอดรวม',                      '合计'),
  ('my_orders_page.subtotal',             'Subtotal',               'ยอดรวมย่อย',                 '小计'),
  ('my_orders_page.discount',             'Discount',               'ส่วนลด',                     '折扣'),
  ('my_orders_page.in_store_order',       'In-Store Order',         'คำสั่งซื้อหน้าร้าน',        '门店订单'),
  ('my_orders_page.online_order',         'Online Order',           'คำสั่งซื้อออนไลน์',         '线上订单'),
  ('my_orders_page.quantity',             'Qty',                    'จำนวน',                       '数量'),
  ('my_orders_page.unit_price',           'Unit Price',             'ราคาต่อหน่วย',               '单价'),
  ('my_orders_page.line_total',           'Total',                  'รวม',                         '小计'),
  ('my_orders_page.no_orders_message',    'You have no orders yet.',  'คุณยังไม่มีคำสั่งซื้อ',   '您还没有任何订单')
ON CONFLICT (key) DO UPDATE SET
  text_en = EXCLUDED.text_en,
  text_th = EXCLUDED.text_th,
  text_zh = EXCLUDED.text_zh;
