/*
  # Seed Initial CMS Data

  This migration seeds the CMS tables with initial data based on the
  existing translations and content in the application.

  1. Categories - Product categories
  2. Products - Sample products  
  3. Pages - Static page content
  4. Labels - UI labels and microcopy
  5. Settings - Configuration
  6. Pickup Locations - Delivery locations
*/

-- Insert Categories
INSERT INTO cms_categories (slug, title_en, title_th, description_en, description_th, sort_order, is_active)
VALUES
  ('croissants', 'Croissants & Pastries', 'ครัวซองและเพสทรี้', 'Buttery, flaky layers made with love and traditional techniques.', 'ชั้นเนยกรอบนอกนุ่มในทำด้วยใจรักและเทคนิคแบบดั้งเดิม', 1, true),
  ('breads', 'Breads', 'ขนมปัง', 'Artisan breads baked fresh with premium ingredients.', 'ขนมปังช่างฝีมืออบสดใหม่ด้วยวัตถุดิบคุณภาพเยี่ยม', 2, true),
  ('cakes', 'Cakes & Cookies', 'เค้กและคุกกี้', 'Sweet treats perfect for any celebration or afternoon delight.', 'ขนมหวานสุดอร่อยเพื่อการเฉลิมฉลองหรือติดตามหลังบ่าย', 3, true),
  ('quiche', 'Quiche, Pizza & More', 'คีช พิซซ่า และอื่นๆ', 'Savory options including buns, quiche, and artisan pizza.', 'เมนูคร่อมรวมถึงขนมปังชนิดต่างๆ คีช และพิซซ่าช่างฝีมือ', 4, true)
ON CONFLICT (slug) DO NOTHING;

-- Insert UI Labels
INSERT INTO cms_labels (key, text_en, text_th)
VALUES
  ('btn_add_to_cart', 'Add to Cart', 'เพิ่มลงตะกร้า'),
  ('btn_browse_products', 'Browse Products', 'ดูสินค้า'),
  ('label_sold_out', 'Sold Out', 'หมดแล้ว'),
  ('checkout_title', 'Checkout', 'ชำระเงิน'),
  ('cart_empty', 'Your cart is empty', 'ตะกร้าของคุณว่างเปล่า'),
  ('price_label', 'Price', 'ราคา'),
  ('quantity_label', 'Quantity', 'จำนวน'),
  ('total_label', 'Total', 'รวม'),
  ('order_button', 'Order Now', 'สั่งซื้อเลย'),
  ('pickup_label', 'Pickup Location', 'สถานที่รับสินค้า')
ON CONFLICT (key) DO NOTHING;

-- Insert Settings
INSERT INTO cms_settings (setting_key, value)
VALUES
  ('order_cutoff_time', 'Thursday 22:00'),
  ('holiday_dates', '["2026-02-14","2026-04-13"]'),
  ('store_name', 'JOKO TODAY'),
  ('store_description', 'Artisan Bakery in Chiang Mai'),
  ('contact_email', 'hello@jokotoday.com')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert Pickup Locations
INSERT INTO cms_pickup_locations (name_en, name_th, description_en, description_th, available_days, sort_order, is_active)
VALUES
  ('Mae Rim Location', 'สาขาแม่ริม', 'Our main bakery location in Mae Rim', 'สาขาเบเกอรี่หลักของเราในแม่ริม', '["Friday","Saturday","Sunday"]'::jsonb, 1, true),
  ('In-Town Location', 'สาขาในเมือง', 'Central Chiang Mai location for convenient pickup', 'สถานที่รับสินค้าในศูนย์กลางเชียงใหม่', '["Friday","Saturday","Sunday"]'::jsonb, 2, true)
ON CONFLICT DO NOTHING;

-- Insert Static Pages
INSERT INTO cms_pages (page_key, title_en, title_th, body_en, body_th)
VALUES
  ('home_hero', 'Artisan Bakery in Chiang Mai', 'เบเกอรี่ช่างฝีมือในเชียงใหม่', 'Freshly baked goods, made with love. Pre-order for weekend pickup.', 'ขนมปังและเบเกอรี่สดใหม่ ทำด้วยใจรัก สั่งจองล่วงหน้าสำหรับรับของสุดสัปดาห์'),
  ('home_cta', 'Ready to Pre-Order?', 'พร้อมสั่งพรีออเดอร์แล้วหรือยัง?', 'Fresh, handcrafted baked goods made with the finest ingredients. Order today, pick up on your chosen day!', 'เบเกอรี่โฮมเมด อบสดใหม่เป็นรอบเล็ก ๆ ด้วยวัตถุดิบคุณภาพ สั่งวันนี้ รับในวันที่คุณเลือก'),
  ('about_intro', 'Our Story', 'เรื่องราวของเรา', 'We are passionate about creating artisan baked goods with premium ingredients.', 'เรากำลังสร้างขนมปังช่างฝีมืออบสดใหม่ด้วยวัตถุดิบคุณภาพ'),
  ('how_it_works', 'How It Works', 'วิธีการสั่งซื้อ', 'Browse our products, add to your cart, and place your pre-order. Pick up on your preferred day.', 'ดูรายชื่อสินค้า เพิ่มลงตะกร้า และสั่งจองล่วงหน้า จากนั้นรับสินค้าในวันที่คุณต้องการ')
ON CONFLICT (page_key) DO NOTHING;
