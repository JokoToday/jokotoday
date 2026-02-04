/*
  # Add short_code to user_profiles table

  1. New Columns
    - `short_code` (text, unique, nullable)
  
  2. Changes
    - Add short_code column to user_profiles to sync with customers table
    - This allows the short code to be fetched directly from user_profiles
  
  3. Data Migration
    - Populate short_code values from customers table where they exist
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'short_code'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN short_code text UNIQUE;
  END IF;
END $$;

UPDATE user_profiles up
SET short_code = c.short_code
FROM customers c
WHERE up.id = c.id AND c.short_code IS NOT NULL;
