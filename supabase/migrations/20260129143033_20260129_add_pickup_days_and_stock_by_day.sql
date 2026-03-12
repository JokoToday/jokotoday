/*
  # Add Pickup Days Configuration and Stock-by-Day Tracking

  1. New Tables
    - `cms_pickup_days` - Configuration for pickup days with cutoff times
  2. New Columns
    - `cms_products.stock_by_day` (jsonb) - Stock quantities for each pickup day
  3. Security
    - RLS enabled on cms_pickup_days
    - Public read access for configuration data
  4. Data
    - Seeded with three default pickup days (Friday, Saturday, Sunday)
*/

CREATE TABLE IF NOT EXISTS cms_pickup_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_key text UNIQUE NOT NULL,
  label text NOT NULL,
  cutoff_time text NOT NULL DEFAULT '22:00',
  is_open boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cms_pickup_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pickup days are viewable by everyone"
  ON cms_pickup_days FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Pickup days can be inserted by anyone"
  ON cms_pickup_days FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Pickup days can be updated by anyone"
  ON cms_pickup_days FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Pickup days can be deleted by anyone"
  ON cms_pickup_days FOR DELETE
  TO anon, authenticated
  USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_products' AND column_name = 'stock_by_day'
  ) THEN
    ALTER TABLE cms_products ADD COLUMN stock_by_day jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

INSERT INTO cms_pickup_days (day_key, label, cutoff_time, is_open, sort_order)
VALUES
  ('friday_maerim', 'Friday – Mae Rim', '22:00', true, 1),
  ('saturday_maerim', 'Saturday – Mae Rim', '22:00', true, 2),
  ('sunday_intown', 'Sunday – In-Town', '22:00', true, 3)
ON CONFLICT (day_key) DO NOTHING;
