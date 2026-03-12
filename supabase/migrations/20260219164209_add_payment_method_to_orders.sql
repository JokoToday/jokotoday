/*
  # Add payment_method column to orders

  1. Changes
    - Adds `payment_method` column to `orders` table
      - Values: 'qr_code', 'cash', or NULL (unknown)

  2. Notes
    - Safe additive migration using IF NOT EXISTS pattern
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method text;
  END IF;
END $$;
