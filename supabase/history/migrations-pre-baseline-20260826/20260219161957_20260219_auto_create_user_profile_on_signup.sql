/*
  # Auto-create user_profiles on auth.users insert

  ## Summary
  Creates a database trigger that automatically inserts a row into
  public.user_profiles whenever a new user is created in auth.users.
  Also backfills any existing auth.users records that are missing a profile.

  ## Changes

  ### New Function: handle_new_user_profile
  - Triggered after every INSERT on auth.users
  - Inserts a row into public.user_profiles using the new user's id and email
  - Generates a qr_token and short_code at creation time
  - Uses ON CONFLICT DO NOTHING to safely skip duplicates
  - SECURITY DEFINER so it runs with elevated privileges to write to user_profiles

  ### New Trigger: on_auth_user_created
  - AFTER INSERT ON auth.users
  - FOR EACH ROW
  - Calls handle_new_user_profile()

  ### Backfill
  - Inserts user_profiles rows for any auth.users record not yet present
  - Safe to run multiple times due to ON CONFLICT DO NOTHING

  ## Notes
  - Does not modify or delete any existing user_profiles rows
  - short_code uses the existing generate_next_short_code() sequential function
  - qr_token is a randomly generated uppercase hex string
*/

-- Function: generate a qr_token value (mirrors frontend generateQRToken logic)
CREATE OR REPLACE FUNCTION generate_qr_token()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN upper(
    to_hex(floor(random() * 2147483647)::int) ||
    to_hex(floor(random() * 2147483647)::int) ||
    to_hex(floor(random() * 2147483647)::int)
  );
END;
$$;

-- Function: handle new auth user -> insert user_profile
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_short_code text;
  v_qr_token text;
BEGIN
  v_short_code := generate_next_short_code();
  v_qr_token   := generate_qr_token();

  INSERT INTO public.user_profiles (
    id,
    email,
    name,
    phone,
    role,
    profile_completed,
    qr_token,
    short_code,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    '',
    'customer',
    false,
    v_qr_token,
    v_short_code,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger: fire after every new auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();

-- Backfill: insert missing user_profiles for existing auth.users
DO $$
DECLARE
  r RECORD;
  v_short_code text;
  v_qr_token text;
BEGIN
  FOR r IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON up.id = au.id
    WHERE up.id IS NULL
    ORDER BY au.created_at ASC
  LOOP
    v_short_code := generate_next_short_code();
    v_qr_token   := generate_qr_token();

    INSERT INTO public.user_profiles (
      id,
      email,
      name,
      phone,
      role,
      profile_completed,
      qr_token,
      short_code,
      created_at,
      updated_at
    )
    VALUES (
      r.id,
      r.email,
      COALESCE(r.raw_user_meta_data->>'full_name', NULL),
      '',
      'customer',
      false,
      v_qr_token,
      v_short_code,
      now(),
      now()
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;
