/*
  # Add email column to user_profiles

  1. Modified Tables
    - `user_profiles`
      - Add `email` (text, nullable) for direct email lookup in QR login
      - Add unique index on `qr_token` for fast QR login lookups

  2. Important Notes
    - email column added to serve as the single source of truth for auth
    - Backfills email from auth.users for existing rows
    - qr_token gets a unique index to enforce one QR per user
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN email text;
  END IF;
END $$;

UPDATE user_profiles
SET email = au.email
FROM auth.users au
WHERE user_profiles.id = au.id
  AND user_profiles.email IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_qr_token
  ON user_profiles (qr_token)
  WHERE qr_token IS NOT NULL;
