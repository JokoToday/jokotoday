/*
  # Create Pickup Cutoff Rules Table

  1. New Tables
    - `pickup_cutoff_rules` - CMS-editable cutoff configuration
      - `id` (uuid, primary key)
      - `pickup_label_en` (text, e.g. "Friday – Mae Rim")
      - `pickup_label_th` (text, e.g. "วันศุกร์ – แม่ริม")
      - `pickup_day` (text, e.g. "Friday")
      - `location` (text, e.g. "Mae Rim")
      - `cutoff_day` (text, e.g. "Wednesday")
      - `cutoff_time` (text, e.g. "17:00")
      - `is_active` (boolean, default true)
      - `sort_order` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `pickup_cutoff_rules` table
    - Add policy for anonymous/authenticated users to read active rules
    - Add policy for admin users to manage all rules

  3. Initial Data
    - Seed with three default pickup options
*/

CREATE TABLE IF NOT EXISTS pickup_cutoff_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_label_en text NOT NULL,
  pickup_label_th text NOT NULL,
  pickup_day text NOT NULL,
  location text NOT NULL,
  cutoff_day text NOT NULL,
  cutoff_time text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pickup_cutoff_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active cutoff rules"
  ON pickup_cutoff_rules FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage all cutoff rules"
  ON pickup_cutoff_rules FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@jokobakery.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'admin@jokobakery.com');

-- Seed initial cutoff rules
INSERT INTO pickup_cutoff_rules (
  pickup_label_en,
  pickup_label_th,
  pickup_day,
  location,
  cutoff_day,
  cutoff_time,
  is_active,
  sort_order
) VALUES
  (
    'Friday – Mae Rim',
    'วันศุกร์ – แม่ริม',
    'Friday',
    'Mae Rim',
    'Wednesday',
    '17:00',
    true,
    1
  ),
  (
    'Saturday – Mae Rim',
    'วันเสาร์ – แม่ริม',
    'Saturday',
    'Mae Rim',
    'Thursday',
    '17:00',
    true,
    2
  ),
  (
    'Sunday – In-Town',
    'วันอาทิตย์ – ในเมือง',
    'Sunday',
    'In-Town',
    'Friday',
    '17:00',
    true,
    3
  )
ON CONFLICT DO NOTHING;