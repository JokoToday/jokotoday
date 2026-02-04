/*
  # Add LINE ID to orders table

  1. New Columns
    - `line_id` (text, optional) - Customer's LINE ID for contact
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'line_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN line_id text;
  END IF;
END $$;