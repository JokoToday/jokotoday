/*
  # Add Walk-In Desk CMS Labels

  1. New CMS Labels
    - Walk-In Desk header and descriptions
    - In-Store Purchase labels for customer order display

  2. Labels added for:
    - Walk-In Desk page title and subtitle
    - In-Store Purchase categorization on My Orders page
    - Loyalty points calculation messaging
*/

INSERT INTO cms_labels (key, text_en, text_th) VALUES
  ('walk_in_desk.header', 'Walk-In Desk', 'เคาน์เตอร์ลูกค้า Walk-In'),
  ('walk_in_desk.subtitle', 'Record in-store purchases for existing members', 'บันทึกการซื้อหน้าร้านสำหรับสมาชิก'),
  ('walk_in_desk.enter_amount', 'Enter paid amount (in-store purchase)', 'กรอกยอดชำระเงิน (ซื้อหน้าร้าน)'),
  ('walk_in_desk.save_button', 'Save Walk-In Purchase', 'บันทึกการซื้อหน้าร้าน'),
  ('walk_in_desk.no_items', 'No item details for walk-in purchases', 'ไม่มีรายละเอียดสินค้าสำหรับการซื้อหน้าร้าน'),
  ('orders_page.in_store_label', 'In-Store Purchase', 'การซื้อหน้าร้าน'),
  ('orders_page.online_tab', '🛍 Online Orders', '🛍 คำสั่งซื้อออนไลน์'),
  ('orders_page.in_store_tab', '🏪 In-Store Purchases', '🏪 การซื้อหน้าร้าน'),
  ('orders_page.no_in_store', 'No in-store purchases yet', 'ยังไม่มีการซื้อหน้าร้าน')
ON CONFLICT (key) DO NOTHING;
