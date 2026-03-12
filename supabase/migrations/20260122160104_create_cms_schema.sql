/*
  # Create CMS Collections

  1. New Tables
    - `cms_categories` - Product categories
    - `cms_products` - Product listings
    - `cms_pages` - Static page content
    - `cms_labels` - UI labels and microcopy
    - `cms_settings` - Configuration and logic
    - `cms_pickup_locations` - Pickup location details

  2. Security
    - Enable RLS on all tables
    - Add public read policies for authenticated users
    - Add admin write policies (will be managed via service role or future admin auth)

  3. Features
    - Sort ordering for categories, products, and locations
    - Bilingual support (English and Thai)
    - Image support for products (URL storage)
    - JSON support for complex data (settings, available_days)
    - Soft delete via is_active flag
*/

-- Categories Collection
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

CREATE POLICY "Categories are publicly readable"
  ON cms_categories FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Products Collection
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cms_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are publicly readable"
  ON cms_products FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Pages / Static Content Collection
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

CREATE POLICY "Pages are publicly readable"
  ON cms_pages FOR SELECT
  TO anon, authenticated
  USING (true);

-- UI Labels / Microcopy Collection
CREATE TABLE IF NOT EXISTS cms_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  text_en text NOT NULL,
  text_th text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cms_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Labels are publicly readable"
  ON cms_labels FOR SELECT
  TO anon, authenticated
  USING (true);

-- Settings / Logic Collection
CREATE TABLE IF NOT EXISTS cms_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cms_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings are publicly readable"
  ON cms_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Pickup Locations Collection
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

CREATE POLICY "Pickup locations are publicly readable"
  ON cms_pickup_locations FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cms_products_category_id ON cms_products(category_id);
CREATE INDEX IF NOT EXISTS idx_cms_products_slug ON cms_products(slug);
CREATE INDEX IF NOT EXISTS idx_cms_categories_slug ON cms_categories(slug);
CREATE INDEX IF NOT EXISTS idx_cms_pages_page_key ON cms_pages(page_key);
CREATE INDEX IF NOT EXISTS idx_cms_labels_key ON cms_labels(key);
CREATE INDEX IF NOT EXISTS idx_cms_settings_setting_key ON cms_settings(setting_key);
