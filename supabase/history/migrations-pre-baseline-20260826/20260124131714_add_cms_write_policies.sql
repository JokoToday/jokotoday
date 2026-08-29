/*
  # Add Write Policies for CMS Tables

  1. Security Changes
    - Add INSERT policies for all CMS tables (anon, authenticated)
    - Add UPDATE policies for all CMS tables (anon, authenticated)
    - Add DELETE policies for all CMS tables (anon, authenticated)

  2. Notes
    - These policies allow write access for admin operations
    - In production, consider using service role key or proper authentication
    - Current implementation supports password-protected admin panel
*/

-- Categories: INSERT, UPDATE, DELETE policies
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

-- Products: INSERT, UPDATE, DELETE policies
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

-- Pages: INSERT, UPDATE, DELETE policies
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

-- Labels: INSERT, UPDATE, DELETE policies
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

-- Settings: INSERT, UPDATE, DELETE policies
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

-- Pickup Locations: INSERT, UPDATE, DELETE policies
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
