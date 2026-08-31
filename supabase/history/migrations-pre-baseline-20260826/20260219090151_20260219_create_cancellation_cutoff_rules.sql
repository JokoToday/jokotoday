/*
  # Create Cancellation Cutoff Rules Table

  ## Summary
  Adds a dedicated table for managing order cancellation deadlines.
  Each record defines a cancellation window for a specific pickup slot,
  with trilingual display text (EN / TH / ZH) shown to customers.

  ## New Tables
  - `cancellation_cutoff_rules`
    - `id` (uuid, PK)
    - `pickup_label_en` (text) — e.g. "Friday – Mae Rim"
    - `pickup_label_th` (text) — e.g. "วันศุกร์ – แม่ริม"
    - `pickup_label_zh` (text, nullable) — e.g. "周五 – 梅林"
    - `cutoff_day` (text) — day of week the cancellation window closes
    - `cutoff_time` (text) — HH:MM time the window closes
    - `notice_en` (text) — customer-facing cancellation policy message (EN)
    - `notice_th` (text) — customer-facing cancellation policy message (TH)
    - `notice_zh` (text, nullable) — customer-facing cancellation policy message (ZH)
    - `is_active` (boolean, default true)
    - `sort_order` (integer, default 0)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Public SELECT for active rules (customers need to see deadlines)
  - Authenticated admin INSERT/UPDATE via service role
*/

CREATE TABLE IF NOT EXISTS cancellation_cutoff_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_label_en text NOT NULL DEFAULT '',
  pickup_label_th text NOT NULL DEFAULT '',
  pickup_label_zh text,
  cutoff_day text NOT NULL DEFAULT '',
  cutoff_time text NOT NULL DEFAULT '17:00',
  notice_en text NOT NULL DEFAULT '',
  notice_th text NOT NULL DEFAULT '',
  notice_zh text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cancellation_cutoff_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active cancellation cutoff rules"
  ON cancellation_cutoff_rules FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can insert cancellation cutoff rules"
  ON cancellation_cutoff_rules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cancellation cutoff rules"
  ON cancellation_cutoff_rules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_cancellation_cutoff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cancellation_cutoff_updated_at
  BEFORE UPDATE ON cancellation_cutoff_rules
  FOR EACH ROW EXECUTE FUNCTION update_cancellation_cutoff_updated_at();
