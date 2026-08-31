/*
  # Add preferred_language to user_profiles

  Adds a `preferred_language` column to the `user_profiles` table so the app
  can persist the user's selected language (en / th / zh) server-side.
  This allows the order confirmation email edge function to detect the correct
  language without relying solely on the frontend call.

  ## Changes
  - `user_profiles.preferred_language` (text, nullable, default 'en')

  ## Notes
  - Existing rows will default to 'en'
  - Column is nullable so no existing data is affected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'preferred_language'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN preferred_language text DEFAULT 'en';
  END IF;
END $$;
