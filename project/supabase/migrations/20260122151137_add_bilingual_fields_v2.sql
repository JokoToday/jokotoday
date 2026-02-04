/*
  # Add Bilingual Fields to Products and Categories

  1. Changes to Categories Table
    - Add `name_en` (text) - English category name
    - Add `name_th` (text) - Thai category name
    - Migrate existing `name` values to `name_en`
    - Add Thai translations for all categories
    - Remove old `name` column after data migration

  2. Changes to Products Table
    - Add `name_en` (text) - English product name
    - Add `name_th` (text) - Thai product name
    - Add `description_en` (text) - English description
    - Add `description_th` (text) - Thai description
    - Migrate existing data to English fields
    - Copy English to Thai as placeholder
    - Remove old columns after migration

  3. Notes
    - All existing data preserved in English fields
    - Thai translations added for categories
    - Products use English as placeholder (to be updated later)
    - RLS policies remain unchanged
*/

-- ============================================
-- CATEGORIES TABLE
-- ============================================

-- Add bilingual fields to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_th text;

-- Migrate existing category names to name_en
UPDATE categories 
SET name_en = name 
WHERE name_en IS NULL AND name IS NOT NULL;

-- Add Thai translations for specific categories
UPDATE categories 
SET name_th = CASE 
  WHEN name = 'Croissants & Pastries' THEN 'ครัวซองและเพสทรี้'
  WHEN name = 'Cakes & Cookies' THEN 'เค้กและคุกกี้'
  WHEN name = 'Breads' THEN 'ขนมปัง'
  WHEN name = 'Pizza' THEN 'พิซซ่า'
  WHEN name = 'Buns & Quiche' THEN 'ขนมปังและคีช'
  ELSE name
END
WHERE name_th IS NULL;

-- Set NOT NULL constraints after data is populated
ALTER TABLE categories ALTER COLUMN name_en SET NOT NULL;
ALTER TABLE categories ALTER COLUMN name_th SET NOT NULL;

-- Drop old name column
ALTER TABLE categories DROP COLUMN IF EXISTS name;

-- ============================================
-- PRODUCTS TABLE
-- ============================================

-- Add bilingual fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_th text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_th text;

-- Migrate existing product data to English fields
UPDATE products 
SET name_en = name 
WHERE name_en IS NULL AND name IS NOT NULL;

UPDATE products 
SET description_en = description 
WHERE description_en IS NULL AND description IS NOT NULL;

-- Use English as placeholder for Thai (will be updated with proper translations)
UPDATE products 
SET name_th = name_en 
WHERE name_th IS NULL AND name_en IS NOT NULL;

UPDATE products 
SET description_th = description_en 
WHERE description_th IS NULL AND description_en IS NOT NULL;

-- Set NOT NULL constraints after data is populated
ALTER TABLE products ALTER COLUMN name_en SET NOT NULL;
ALTER TABLE products ALTER COLUMN name_th SET NOT NULL;
ALTER TABLE products ALTER COLUMN description_en SET NOT NULL;
ALTER TABLE products ALTER COLUMN description_th SET NOT NULL;

-- Drop old columns
ALTER TABLE products DROP COLUMN IF EXISTS name;
ALTER TABLE products DROP COLUMN IF EXISTS description;
