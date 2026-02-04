/*
  # Complete Joko Bakery Database Setup
  
  This migration sets up the complete database schema for the Joko Bakery application.
  
  ## Tables Created
  
  ### CMS Collections
  - `cms_categories` - Product categories (bilingual)
  - `cms_products` - Product listings (bilingual)
  - `cms_pages` - Static page content (bilingual)
  - `cms_labels` - UI labels and microcopy (bilingual)
  - `cms_settings` - Configuration and logic
  - `cms_pickup_locations` - Pickup location details (bilingual)
  - `auth_users` - User profile table linked to auth.users
  
  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Public read access for CMS content
  - Write access for admin operations
  - Authenticated user policies for auth_users
  
  ## Features
  - Bilingual support (English and Thai)
  - Sort ordering for categories, products, and locations
  - Image support for products (URL storage)
  - JSON support for complex data
  - Stock management with automatic initialization
  - Soft delete via is_active flag
*/

-- ============================================
-- CMS CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS cms_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title_en text NOT NULL,
  title_th text NOT NULL,
  description_en text,
  description_th text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cms_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by everyone"
  ON cms_categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Categories can be inserted by anyone"
  ON cms_categories FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Categories can be updated by anyone"
  ON cms_categories FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Categories can be deleted by anyone"
  ON cms_categories FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================
-- CMS PRODUCTS
-- ============================================
CREATE TABLE IF NOT EXISTS cms_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  category_id uuid NOT NULL REFERENCES cms_categories(id) ON DELETE RESTRICT,
  name_en text NOT NULL,
  name_th text NOT NULL,
  desc_en text NOT NULL,
  desc_th text NOT NULL,
  price numeric(10, 2) NOT NULL,
  image text,
  is_sold_out boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  stock_total integer,
  stock_remaining integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cms_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are viewable by everyone"
  ON cms_products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Products can be inserted by anyone"
  ON cms_products FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Products can be updated by anyone"
  ON cms_products FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Products can be deleted by anyone"
  ON cms_products FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================
-- CMS PAGES
-- ============================================
CREATE TABLE IF NOT EXISTS cms_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text UNIQUE NOT NULL,
  title_en text NOT NULL,
  title_th text NOT NULL,
  body_en text NOT NULL,
  body_th text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cms_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pages are viewable by everyone"
  ON cms_pages FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Pages can be inserted by anyone"
  ON cms_pages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Pages can be updated by anyone"
  ON cms_pages FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Pages can be deleted by anyone"
  ON cms_pages FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================
-- CMS LABELS
-- ============================================
CREATE TABLE IF NOT EXISTS cms_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  text_en text NOT NULL,
  text_th text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cms_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Labels are viewable by everyone"
  ON cms_labels FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Labels can be inserted by anyone"
  ON cms_labels FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Labels can be updated by anyone"
  ON cms_labels FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Labels can be deleted by anyone"
  ON cms_labels FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================
-- CMS SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS cms_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cms_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings are viewable by everyone"
  ON cms_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Settings can be inserted by anyone"
  ON cms_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Settings can be updated by anyone"
  ON cms_settings FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Settings can be deleted by anyone"
  ON cms_settings FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================
-- CMS PICKUP LOCATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS cms_pickup_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_th text NOT NULL,
  description_en text,
  description_th text,
  maps_url text,
  available_days jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cms_pickup_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pickup locations are viewable by everyone"
  ON cms_pickup_locations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Pickup locations can be inserted by anyone"
  ON cms_pickup_locations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Pickup locations can be updated by anyone"
  ON cms_pickup_locations FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Pickup locations can be deleted by anyone"
  ON cms_pickup_locations FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================
-- AUTH USERS
-- ============================================
CREATE TABLE IF NOT EXISTS auth_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own auth profile"
  ON auth_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_cms_products_category_id ON cms_products(category_id);
CREATE INDEX IF NOT EXISTS idx_cms_products_slug ON cms_products(slug);
CREATE INDEX IF NOT EXISTS idx_cms_categories_slug ON cms_categories(slug);
CREATE INDEX IF NOT EXISTS idx_cms_pages_page_key ON cms_pages(page_key);
CREATE INDEX IF NOT EXISTS idx_cms_labels_key ON cms_labels(key);
CREATE INDEX IF NOT EXISTS idx_cms_settings_setting_key ON cms_settings(setting_key);

-- ============================================
-- STOCK MANAGEMENT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION initialize_stock_remaining()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock_remaining IS NULL THEN
    NEW.stock_remaining := NEW.stock_total;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_initial_stock ON cms_products;

CREATE TRIGGER set_initial_stock
  BEFORE INSERT ON cms_products
  FOR EACH ROW
  EXECUTE FUNCTION initialize_stock_remaining();

-- ============================================
-- SEED DATA: CATEGORIES
-- ============================================
INSERT INTO cms_categories (slug, title_en, title_th, description_en, description_th, sort_order, is_active)
VALUES
  ('croissants', 'Croissants & Pastries', 'ครัวซองและเพสทรี้', 'Buttery, flaky layers made with love and traditional techniques.', 'ชั้นเนยกรอบนอกนุ่มในทำด้วยใจรักและเทคนิคแบบดั้งเดิม', 1, true),
  ('breads', 'Breads', 'ขนมปัง', 'Artisan breads baked fresh with premium ingredients.', 'ขนมปังช่างฝีมืออบสดใหม่ด้วยวัตถุดิบคุณภาพเยี่ยม', 2, true),
  ('cakes', 'Cakes & Cookies', 'เค้กและคุกกี้', 'Sweet treats perfect for any celebration or afternoon delight.', 'ขนมหวานสุดอร่อยเพื่อการเฉลิมฉลองหรือติดตามหลังบ่าย', 3, true),
  ('quiche', 'Quiche, Pizza & More', 'คีช พิซซ่า และอื่นๆ', 'Savory options including buns, quiche, and artisan pizza.', 'เมนูคร่อมรวมถึงขนมปังชนิดต่างๆ คีช และพิซซ่าช่างฝีมือ', 4, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- SEED DATA: PRODUCTS
-- ============================================
INSERT INTO cms_products (slug, category_id, name_en, name_th, desc_en, desc_th, price, is_sold_out, is_active, sort_order)
SELECT
  'chocolate-croissant',
  c.id,
  'Chocolate Croissant',
  'ครัวซองช็อกโกแลต',
  'Buttery croissant filled with rich dark chocolate. Perfect for breakfast or any time of day.',
  'ครัวซองเนยกรอบกรอบเต็มไปด้วยช็อกโกแลตดำเข้มข้น สมบูรณ์แบบสำหรับอาหารเช้าหรือเวลาใด ๆ',
  45.00,
  false,
  true,
  1
FROM cms_categories c
WHERE c.slug = 'croissants'
ON CONFLICT DO NOTHING;

INSERT INTO cms_products (slug, category_id, name_en, name_th, desc_en, desc_th, price, is_sold_out, is_active, sort_order)
SELECT
  'plain-croissant',
  c.id,
  'Plain Croissant',
  'ครัวซองธรรมชาติ',
  'Classic all-butter croissant with delicate, flaky layers. A timeless favorite.',
  'ครัวซองเนยแบบคลาสสิกพร้อมชั้นกรอบเนียบ ตัวเลือกโปรดแบบนิรันดร์',
  40.00,
  false,
  true,
  2
FROM cms_categories c
WHERE c.slug = 'croissants'
ON CONFLICT DO NOTHING;

INSERT INTO cms_products (slug, category_id, name_en, name_th, desc_en, desc_th, price, is_sold_out, is_active, sort_order)
SELECT
  'almond-croissant',
  c.id,
  'Almond Croissant',
  'ครัวซองอัลมอนด์',
  'Topped with sliced almonds and a hint of almond cream. A nutty delight.',
  'ตกแต่งด้วยอัลมอนด์สไลซ์และครีมอัลมอนด์เบาๆ ความสุขของถั่ว',
  48.00,
  false,
  true,
  3
FROM cms_categories c
WHERE c.slug = 'croissants'
ON CONFLICT DO NOTHING;

INSERT INTO cms_products (slug, category_id, name_en, name_th, desc_en, desc_th, price, is_sold_out, is_active, sort_order)
SELECT
  'sourdough-loaf',
  c.id,
  'Sourdough Loaf',
  'ขนมปังฟืนสูร',
  'Artisan sourdough with a tangy flavor and chewy crumb. Perfect for sandwiches or toasting.',
  'ขนมปังฟืนสูรช่างฝีมือพร้อมรสชาติเปรี้ยวและเนื้อที่เหนียว สมบูรณ์แบบสำหรับแซนด์วิชหรือปิ้งขนมปัง',
  65.00,
  false,
  true,
  1
FROM cms_categories c
WHERE c.slug = 'breads'
ON CONFLICT DO NOTHING;

INSERT INTO cms_products (slug, category_id, name_en, name_th, desc_en, desc_th, price, is_sold_out, is_active, sort_order)
SELECT
  'multigrain-bread',
  c.id,
  'Multigrain Bread',
  'ขนมปังธัญพืชหลายชนิด',
  'Hearty multigrain loaf loaded with seeds and whole grains. Nutritious and delicious.',
  'ขนมปังธัญพืชหลายชนิดเต็มไปด้วยเมล็ดและธัญพืชทั้งหมด มีประโยชน์และอร่อยเลิศ',
  58.00,
  false,
  true,
  2
FROM cms_categories c
WHERE c.slug = 'breads'
ON CONFLICT DO NOTHING;

INSERT INTO cms_products (slug, category_id, name_en, name_th, desc_en, desc_th, price, is_sold_out, is_active, sort_order)
SELECT
  'chocolate-cake',
  c.id,
  'Chocolate Cake',
  'เค้กช็อกโกแลต',
  'Rich, moist chocolate cake with a silky chocolate ganache. A chocolate lover''s dream.',
  'เค้กช็อกโกแลตเนื้ออ่อนอุดมสมบูรณ์พร้อมกาแนชช็อกโกแลตเรียบเนียน ฝันของคนรักช็อกโกแลต',
  120.00,
  false,
  true,
  1
FROM cms_categories c
WHERE c.slug = 'cakes'
ON CONFLICT DO NOTHING;

INSERT INTO cms_products (slug, category_id, name_en, name_th, desc_en, desc_th, price, is_sold_out, is_active, sort_order)
SELECT
  'strawberry-shortcake',
  c.id,
  'Strawberry Shortcake',
  'เค้กสตรอเบอร์รี่',
  'Light sponge cake layered with fresh strawberries and whipped cream.',
  'เค้กฟองน้ำเบาเรียงซ้อนกับสตรอเบอร์รี่สดและครีมเบา',
  110.00,
  false,
  true,
  2
FROM cms_categories c
WHERE c.slug = 'cakes'
ON CONFLICT DO NOTHING;

INSERT INTO cms_products (slug, category_id, name_en, name_th, desc_en, desc_th, price, is_sold_out, is_active, sort_order)
SELECT
  'spinach-quiche',
  c.id,
  'Spinach & Cheese Quiche',
  'แพยผักโขมและชีส',
  'Savory quiche filled with fresh spinach, cheese, and cream. Perfect for brunch.',
  'แพยคร่อมเต็มไปด้วยผักโขมสด ชีส และครีม สมบูรณ์แบบสำหรับอาหารเช้า',
  95.00,
  false,
  true,
  1
FROM cms_categories c
WHERE c.slug = 'quiche'
ON CONFLICT DO NOTHING;

INSERT INTO cms_products (slug, category_id, name_en, name_th, desc_en, desc_th, price, is_sold_out, is_active, sort_order)
SELECT
  'mushroom-pizza',
  c.id,
  'Mushroom Pizza',
  'พิซซ่าเห็ด',
  'Artisan pizza with fresh mushrooms, cheese, and herbs. A vegetarian favorite.',
  'พิซซ่าช่างฝีมืออาหารมัดมะกรูด สด ชีส และสมุนไพร ตัวเลือกโปรดสำหรับผักเจ',
  110.00,
  false,
  true,
  2
FROM cms_categories c
WHERE c.slug = 'quiche'
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED DATA: UI LABELS
-- ============================================
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

-- ============================================
-- SEED DATA: SETTINGS
-- ============================================
INSERT INTO cms_settings (setting_key, value)
VALUES
  ('order_cutoff_time', 'Thursday 22:00'),
  ('holiday_dates', '["2026-02-14","2026-04-13"]'),
  ('store_name', 'JOKO TODAY'),
  ('store_description', 'Artisan Bakery in Chiang Mai'),
  ('contact_email', 'hello@jokotoday.com')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- SEED DATA: PICKUP LOCATIONS
-- ============================================
INSERT INTO cms_pickup_locations (name_en, name_th, description_en, description_th, available_days, sort_order, is_active)
VALUES
  ('Mae Rim Location', 'สาขาแม่ริม', 'Our main bakery location in Mae Rim', 'สาขาเบเกอรี่หลักของเราในแม่ริม', '["Friday","Saturday","Sunday"]'::jsonb, 1, true),
  ('In-Town Location', 'สาขาในเมือง', 'Central Chiang Mai location for convenient pickup', 'สถานที่รับสินค้าในศูนย์กลางเชียงใหม่', '["Friday","Saturday","Sunday"]'::jsonb, 2, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED DATA: STATIC PAGES
-- ============================================
INSERT INTO cms_pages (page_key, title_en, title_th, body_en, body_th)
VALUES
  ('home_hero', 'Artisan Bakery in Chiang Mai', 'เบเกอรี่ช่างฝีมือในเชียงใหม่', 'Freshly baked goods, made with love. Pre-order for weekend pickup.', 'ขนมปังและเบเกอรี่สดใหม่ ทำด้วยใจรัก สั่งจองล่วงหน้าสำหรับรับของสุดสัปดาห์'),
  ('home_cta', 'Ready to Pre-Order?', 'พร้อมสั่งพรีออเดอร์แล้วหรือยัง?', 'Fresh, handcrafted baked goods made with the finest ingredients. Order today, pick up on your chosen day!', 'เบเกอรี่โฮมเมด อบสดใหม่เป็นรอบเล็ก ๆ ด้วยวัตถุดิบคุณภาพ สั่งวันนี้ รับในวันที่คุณเลือก'),
  ('about_intro', 'Our Story', 'เรื่องราวของเรา', 'We are passionate about creating artisan baked goods with premium ingredients.', 'เรากำลังสร้างขนมปังช่างฝีมืออบสดใหม่ด้วยวัตถุดิบคุณภาพ'),
  ('how_it_works', 'How It Works', 'วิธีการสั่งซื้อ', 'Browse our products, add to your cart, and place your pre-order. Pick up on your preferred day.', 'ดูรายชื่อสินค้า เพิ่มลงตะกร้า และสั่งจองล่วงหน้า จากนั้นรับสินค้าในวันที่คุณต้องการ')
ON CONFLICT (page_key) DO NOTHING;
