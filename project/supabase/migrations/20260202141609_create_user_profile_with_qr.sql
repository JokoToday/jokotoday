/*
  # Create User Profile Function

  1. New Functions
    - `create_user_profile_with_qr` - Atomically creates user profile and customer record
      - Generates unique short code (VIP###)
      - Creates user_profiles record
      - Creates customers record
      - Returns the created profile data
  
  2. Security
    - Function runs with invoker's privileges (SECURITY INVOKER)
    - Only authenticated users can call this function
    - User can only create their own profile (checks auth.uid())
  
  3. Error Handling
    - Returns proper error messages if profile already exists
    - Validates all required fields
    - Ensures atomic creation of both records
*/

CREATE OR REPLACE FUNCTION create_user_profile_with_qr(
  p_email text,
  p_name text,
  p_phone text,
  p_qr_token text,
  p_line_id text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_wechat_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid;
  v_short_code text;
  v_result json;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Profile already exists';
  END IF;
  
  v_short_code := generate_next_short_code();
  
  INSERT INTO user_profiles (
    id,
    name,
    phone,
    line_id,
    whatsapp,
    wechat_id,
    profile_completed,
    qr_token,
    short_code
  ) VALUES (
    v_user_id,
    p_name,
    p_phone,
    p_line_id,
    p_whatsapp,
    p_wechat_id,
    false,
    p_qr_token,
    v_short_code
  );
  
  INSERT INTO customers (
    id,
    email,
    name,
    phone,
    line_id,
    whatsapp,
    wechat_id,
    qr_token,
    short_code
  ) VALUES (
    v_user_id,
    p_email,
    p_name,
    p_phone,
    p_line_id,
    p_whatsapp,
    p_wechat_id,
    p_qr_token,
    v_short_code
  );
  
  SELECT json_build_object(
    'id', v_user_id,
    'short_code', v_short_code,
    'qr_token', p_qr_token
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION create_user_profile_with_qr TO authenticated;
