/*
  # Add Chinese Language Fields

  1. Overview
    This migration adds Chinese (Simplified) language support to the database
    by adding Chinese text fields to various CMS tables.

  2. Changes to cms_products Table
    - `name_zh` (text) - Chinese product name
    - `desc_zh` (text) - Chinese product description

  3. Changes to cms_categories Table
    - `title_zh` (text) - Chinese category title
    - `description_zh` (text) - Chinese category description

  4. Changes to cms_pickup_days Table
    - `label_zh` (text) - Chinese label for pickup day

  5. Changes to cms_labels Table
    - `text_zh` (text) - Chinese label value

  6. Changes to cms_pickup_locations Table
    - `name_zh` (text) - Chinese location name
    - `description_zh` (text) - Chinese location description

  7. Changes to cms_pages Table
    - `title_zh` (text) - Chinese page title
    - `body_zh` (text) - Chinese page body

  8. Changes to pickup_cutoff_rules Table
    - `pickup_label_zh` (text) - Chinese pickup label

  9. Changes to pickup_overrides Table
    - `note_zh` (text) - Chinese note for override

  10. Notes
    - All new columns are nullable to maintain backwards compatibility
    - Existing English and Thai fields remain unchanged
    - Applications should fall back to English if Chinese value is not set
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_products' AND column_name = 'name_zh'
  ) THEN
    ALTER TABLE cms_products ADD COLUMN name_zh text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_products' AND column_name = 'desc_zh'
  ) THEN
    ALTER TABLE cms_products ADD COLUMN desc_zh text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_categories' AND column_name = 'title_zh'
  ) THEN
    ALTER TABLE cms_categories ADD COLUMN title_zh text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_categories' AND column_name = 'description_zh'
  ) THEN
    ALTER TABLE cms_categories ADD COLUMN description_zh text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_pickup_days' AND column_name = 'label_zh'
  ) THEN
    ALTER TABLE cms_pickup_days ADD COLUMN label_zh text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_labels' AND column_name = 'text_zh'
  ) THEN
    ALTER TABLE cms_labels ADD COLUMN text_zh text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_pickup_locations' AND column_name = 'name_zh'
  ) THEN
    ALTER TABLE cms_pickup_locations ADD COLUMN name_zh text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_pickup_locations' AND column_name = 'description_zh'
  ) THEN
    ALTER TABLE cms_pickup_locations ADD COLUMN description_zh text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_pages' AND column_name = 'title_zh'
  ) THEN
    ALTER TABLE cms_pages ADD COLUMN title_zh text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_pages' AND column_name = 'body_zh'
  ) THEN
    ALTER TABLE cms_pages ADD COLUMN body_zh text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_cutoff_rules' AND column_name = 'pickup_label_zh'
  ) THEN
    ALTER TABLE pickup_cutoff_rules ADD COLUMN pickup_label_zh text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_overrides' AND column_name = 'note_zh'
  ) THEN
    ALTER TABLE pickup_overrides ADD COLUMN note_zh text DEFAULT '';
  END IF;
END $$;

UPDATE cms_pickup_days SET label_zh = '周五 – 湄林' WHERE day_key = 'friday';
UPDATE cms_pickup_days SET label_zh = '周六 – 湄林' WHERE day_key = 'saturday';
UPDATE cms_pickup_days SET label_zh = '周日 – 市区' WHERE day_key = 'sunday';

UPDATE pickup_cutoff_rules SET pickup_label_zh = '周五 – 湄林' WHERE pickup_day = 'Friday';
UPDATE pickup_cutoff_rules SET pickup_label_zh = '周六 – 湄林' WHERE pickup_day = 'Saturday';
UPDATE pickup_cutoff_rules SET pickup_label_zh = '周日 – 市区' WHERE pickup_day = 'Sunday';

UPDATE cms_pickup_locations SET name_zh = '湄林烘焙坊', description_zh = '泰国清迈湄林' WHERE name_en ILIKE '%mae rim%';
UPDATE cms_pickup_locations SET name_zh = '市区取货点', description_zh = '泰国清迈' WHERE name_en ILIKE '%town%' OR name_en ILIKE '%city%';
