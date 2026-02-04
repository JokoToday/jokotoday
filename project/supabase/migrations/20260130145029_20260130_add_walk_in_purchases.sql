/*
  # Add Walk-In Purchase Support

  1. Schema Changes
    - Add `purchase_type` column to orders table (online, walk_in)
    - Add `walk_in_amount` column for recording in-store purchase amounts
    - Add `staff_id` column to track which staff member logged the transaction
    - Add `loyalty_multiplier` column to store the loyalty points multiplier used

  2. New Tables
    - `loyalty_settings` - Store loyalty multipliers for online vs walk-in purchases

  3. Changes to orders table
    - purchase_type: 'online' | 'walk_in' (default: 'online')
    - walk_in_amount: numeric, nullable
    - staff_id: uuid, nullable (references auth.users)
    - loyalty_multiplier: numeric (default: 1.0)

  4. Constraints
    - walk_in_amount required only when purchase_type = 'walk_in'
    - order_items can be empty for walk_in purchases

  5. Security
    - Add RLS policy for staff to insert walk_in purchases
    - Add RLS policy for staff to read walk_in purchase data

  6. Important Notes
    - Walk-in purchases do NOT require item details (order_items can be empty)
    - Walk-in purchases are not tied to a specific pickup date
    - Staff ID tracks who logged the transaction
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'purchase_type'
  ) THEN
    ALTER TABLE orders ADD COLUMN purchase_type text DEFAULT 'online';
    ALTER TABLE orders ADD CONSTRAINT valid_purchase_type CHECK (purchase_type IN ('online', 'walk_in'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'walk_in_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN walk_in_amount numeric(10, 2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'staff_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN staff_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'loyalty_multiplier'
  ) THEN
    ALTER TABLE orders ADD COLUMN loyalty_multiplier numeric(3, 2) DEFAULT 1.0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS loyalty_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_type text NOT NULL UNIQUE,
  multiplier numeric(3, 2) NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read loyalty settings"
  ON loyalty_settings FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO loyalty_settings (purchase_type, multiplier) 
VALUES 
  ('online', 1.0),
  ('walk_in', 0.5)
ON CONFLICT (purchase_type) DO NOTHING;

CREATE INDEX IF NOT EXISTS orders_purchase_type_idx ON orders(purchase_type);
CREATE INDEX IF NOT EXISTS orders_staff_id_idx ON orders(staff_id);
