/*
  # Fix Short Code Generation for JOKO TODAY
  
  1. Changes
    - Update `generate_next_short_code` function to check BOTH user_profiles AND customers tables
    - This ensures no conflicts and proper sequential numbering (VIP101, VIP102, VIP103...)
    - Function starts at VIP101 (not VIP001) as requested
  
  2. Security
    - Function remains accessible to all authenticated users
    - No changes to RLS policies
*/

CREATE OR REPLACE FUNCTION generate_next_short_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_number integer;
  v_new_code text;
BEGIN
  -- Check both user_profiles and customers tables to find the highest number
  SELECT GREATEST(
    COALESCE(
      (SELECT MAX(CAST(SUBSTRING(short_code, 4) AS integer))
       FROM customers
       WHERE short_code ~ '^VIP[0-9]+$'),
      100
    ),
    COALESCE(
      (SELECT MAX(CAST(SUBSTRING(short_code, 4) AS integer))
       FROM user_profiles
       WHERE short_code ~ '^VIP[0-9]+$'),
      100
    )
  ) INTO v_max_number;
  
  -- Generate next code (starts at VIP101)
  v_new_code := 'VIP' || (v_max_number + 1)::text;
  
  RETURN v_new_code;
END;
$$;