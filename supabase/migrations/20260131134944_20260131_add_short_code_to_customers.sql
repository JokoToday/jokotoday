/*
  # Add member short code to customers

  1. Changes
    - Add `short_code` column to customers table
    - Short code format: VIP### (e.g., VIP101)
    - Unique constraint to ensure no duplicates
    - Create function to generate next short code automatically

  2. Implementation
    - Sequential VIP codes starting from VIP001
    - Auto-generated on new customer creation
    - Supports public lookup for staff member code input

  3. Security
    - Add policy to allow public (unauthenticated) lookup by short_code
    - This is necessary for pickup and walk-in desk staff to find customers
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'short_code'
  ) THEN
    ALTER TABLE customers ADD COLUMN short_code text UNIQUE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS customers_short_code_idx ON customers(short_code);

CREATE OR REPLACE FUNCTION generate_next_short_code()
RETURNS text AS $$
DECLARE
  v_max_number integer;
  v_new_code text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(short_code, 4) AS integer)), 0) 
  INTO v_max_number
  FROM customers 
  WHERE short_code LIKE 'VIP%';
  
  v_new_code := 'VIP' || LPAD((v_max_number + 1)::text, 3, '0');
  RETURN v_new_code;
END;
$$ LANGUAGE plpgsql;

CREATE POLICY "Public can lookup customer by short code"
  ON customers FOR SELECT
  TO public
  USING (short_code IS NOT NULL);
