/*
  # Fix CMS SELECT Policies for Admin Access

  1. Changes
    - Drop existing restrictive SELECT policies
    - Add new SELECT policies that allow viewing ALL records
    - This enables admin panel to view inactive/draft content
    - Frontend will handle filtering for public vs admin views

  2. Security Note
    - All CMS data is considered public-readable
    - Visibility control is handled at the application layer
    - Write operations still require proper authorization
*/

-- Drop and recreate SELECT policies for all CMS tables

-- Categories
DROP POLICY IF EXISTS "Categories are publicly readable" ON cms_categories;
CREATE POLICY "Categories are viewable by everyone"
  ON cms_categories FOR SELECT
  TO anon, authenticated
  USING (true);

-- Products
DROP POLICY IF EXISTS "Products are publicly readable" ON cms_products;
CREATE POLICY "Products are viewable by everyone"
  ON cms_products FOR SELECT
  TO anon, authenticated
  USING (true);

-- Pages
DROP POLICY IF EXISTS "Pages are publicly readable" ON cms_pages;
CREATE POLICY "Pages are viewable by everyone"
  ON cms_pages FOR SELECT
  TO anon, authenticated
  USING (true);

-- Labels
DROP POLICY IF EXISTS "Labels are publicly readable" ON cms_labels;
CREATE POLICY "Labels are viewable by everyone"
  ON cms_labels FOR SELECT
  TO anon, authenticated
  USING (true);

-- Settings
DROP POLICY IF EXISTS "Settings are publicly readable" ON cms_settings;
CREATE POLICY "Settings are viewable by everyone"
  ON cms_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Pickup Locations
DROP POLICY IF EXISTS "Pickup locations are publicly readable" ON cms_pickup_locations;
CREATE POLICY "Pickup locations are viewable by everyone"
  ON cms_pickup_locations FOR SELECT
  TO anon, authenticated
  USING (true);
