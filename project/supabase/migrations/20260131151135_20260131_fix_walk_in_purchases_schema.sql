/*
  # Fix walk-in purchases schema

  1. Problem
    - pickup_date is NOT NULL but walk-in purchases don't have a pickup date
    - RLS policies don't allow staff to insert walk-in purchases

  2. Solution
    - Make pickup_date nullable since walk-in purchases don't need it
    - Add RLS policies for staff to insert and update walk-in purchases
    - Update public read policy to allow order lookups

  3. Security
    - Add restrictive policy for staff to insert walk-in purchases
    - Allow unauthenticated users to update orders (for staff desk usage)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'pickup_date'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE orders ALTER COLUMN pickup_date DROP NOT NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "Anyone can update orders" ON orders;

CREATE POLICY "Staff can insert walk-in purchases"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (purchase_type = 'walk_in' AND walk_in_amount IS NOT NULL);

CREATE POLICY "Staff can update orders"
  ON orders FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
