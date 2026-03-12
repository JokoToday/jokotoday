/*
  # Create Pickup Overrides Table

  1. New Tables
    - `pickup_overrides` - Holiday and special date overrides
      - `id` (uuid, primary key)
      - `date` (date, override applies to this specific date)
      - `pickup_day` (text, e.g. "Friday", "Saturday", "Sunday")
      - `location` (text, e.g. "Mae Rim", "In-Town")
      - `override_type` (text, one of: "closed", "custom_cutoff", "sold_out")
      - `custom_cutoff_day` (text, nullable, only for custom_cutoff type)
      - `custom_cutoff_time` (text, nullable, only for custom_cutoff type)
      - `note_en` (text, admin note in English)
      - `note_th` (text, admin note in Thai)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `pickup_overrides` table
    - Add policy for anonymous/authenticated users to read active overrides
    - Add policy for admin users to manage all overrides

  3. Indexes
    - Create index on date for fast lookups
    - Create composite index on (date, pickup_day, location)
*/

CREATE TABLE IF NOT EXISTS pickup_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  pickup_day text NOT NULL,
  location text NOT NULL,
  override_type text NOT NULL CHECK (override_type IN ('closed', 'custom_cutoff', 'sold_out')),
  custom_cutoff_day text,
  custom_cutoff_time text,
  note_en text DEFAULT '',
  note_th text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pickup_overrides_date ON pickup_overrides(date);
CREATE INDEX IF NOT EXISTS idx_pickup_overrides_lookup ON pickup_overrides(date, pickup_day, location) WHERE is_active = true;

ALTER TABLE pickup_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active overrides"
  ON pickup_overrides FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage all overrides"
  ON pickup_overrides FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@jokobakery.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'admin@jokobakery.com');