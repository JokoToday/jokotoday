/*
  # Add Pickup Day Support

  1. New Columns
    - `cms_products.available_days` (jsonb) - Array of pickup days when product is available
    - `orders.pickup_day` (text) - Selected pickup day for the order
  2. Changes
    - Add available_days column to cms_products table
    - Add pickup_day column to orders table
  3. Security
    - No new tables, only schema updates
    - Existing RLS policies remain in effect
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_products' AND column_name = 'available_days'
  ) THEN
    ALTER TABLE cms_products ADD COLUMN available_days jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'pickup_day'
  ) THEN
    ALTER TABLE orders ADD COLUMN pickup_day text;
  END IF;
END $$;
