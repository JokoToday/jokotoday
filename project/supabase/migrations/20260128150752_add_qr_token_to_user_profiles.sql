/*
  # Add QR Token to User Profiles

  1. Changes
    - Add qr_token column to user_profiles table
    - Make qr_token unique and nullable
    - Add index for faster lookups

  2. Notes
    - QR token is used for customer loyalty and pickup verification
    - Generated when profile is completed
*/

-- Add qr_token column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'qr_token'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN qr_token text UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_user_profiles_qr_token ON user_profiles(qr_token);
  END IF;
END $$;
