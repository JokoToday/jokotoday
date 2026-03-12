/*
  # Seed CMS Products

  Add sample products to the cms_products table for each category.
  Products are linked to their respective categories by slug matching.
*/

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
