/*
  # Create Site Social Links Table

  1. New Tables
    - `site_social_links` - Stores social media links for footer display
      - `id` (uuid, primary key)
      - `name` (text) - Internal identifier (facebook, x, google_maps, etc.)
      - `label` (text) - Display name for accessibility
      - `url` (text) - Full URL to social media page
      - `icon` (text) - Icon key for frontend mapping
      - `sort_order` (int) - Display order
      - `is_active` (boolean) - Toggle visibility
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `site_social_links` table
    - Public can read active links only
    - Authenticated users can manage links

  3. Initial Data
    - Facebook, Google Maps, and X (Twitter) links
*/

CREATE TABLE IF NOT EXISTS site_social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  icon text NOT NULL,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE site_social_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active social links" ON site_social_links;
DROP POLICY IF EXISTS "Authenticated users can manage social links" ON site_social_links;
DROP POLICY IF EXISTS "Authenticated users can insert social links" ON site_social_links;
DROP POLICY IF EXISTS "Authenticated users can update social links" ON site_social_links;
DROP POLICY IF EXISTS "Authenticated users can delete social links" ON site_social_links;

CREATE POLICY "Public can view active social links"
  ON site_social_links FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Authenticated users can insert social links"
  ON site_social_links FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update social links"
  ON site_social_links FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete social links"
  ON site_social_links FOR DELETE
  TO authenticated
  USING (true);

INSERT INTO site_social_links (name, label, url, icon, sort_order, is_active)
VALUES
  ('facebook', 'Facebook', 'https://www.facebook.com/JoKoBakery', 'facebook', 1, true),
  ('google_maps', 'Google Maps', 'https://maps.app.goo.gl/V89Pm5vxaCE8doA88', 'map-pin', 2, true),
  ('x', 'X (Twitter)', 'https://x.com/jokotoday', 'twitter', 3, true)
ON CONFLICT DO NOTHING;
