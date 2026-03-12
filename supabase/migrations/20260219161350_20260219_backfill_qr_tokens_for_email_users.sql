/*
  # Backfill QR tokens and short codes for email-registered users

  ## Problem
  Users who registered via email/password have user_profiles rows but
  no qr_token or short_code, causing "Customer not found" on account pages.

  ## Changes
  - Backfill qr_token for any user_profiles rows where it is NULL
  - Backfill short_code for any user_profiles rows where it is NULL
    using the existing generate_next_short_code() sequential function

  ## Notes
  - Uses a loop to assign unique sequential VIP codes
  - Safe to run multiple times (only updates NULL values)
*/

DO $$
DECLARE
  r RECORD;
  v_token TEXT;
  v_short_code TEXT;
BEGIN
  FOR r IN
    SELECT id FROM user_profiles
    WHERE qr_token IS NULL OR short_code IS NULL
    ORDER BY created_at ASC
  LOOP
    -- Generate a qr_token if missing
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles WHERE id = r.id AND qr_token IS NOT NULL
    ) THEN
      v_token := upper(
        to_hex(floor(random() * 2147483647)::int) ||
        to_hex(floor(random() * 2147483647)::int) ||
        to_hex(floor(random() * 2147483647)::int)
      );
      UPDATE user_profiles SET qr_token = v_token WHERE id = r.id;
    END IF;

    -- Generate a short_code if missing
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles WHERE id = r.id AND short_code IS NOT NULL
    ) THEN
      v_short_code := generate_next_short_code();
      UPDATE user_profiles SET short_code = v_short_code WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
