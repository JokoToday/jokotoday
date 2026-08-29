/*
  # Fix Signup Flow - Remove Conflicting Auto-Trigger

  1. Problem
    - Auto-trigger `on_auth_user_created` tries to create user_profiles automatically
    - Trigger doesn't set required fields (name, phone are empty strings)
    - Trigger doesn't generate short_code
    - Trigger doesn't create customers record
    - This conflicts with manual profile creation in signup flow
    - Results in "database error" for users

  2. Solution
    - Drop the auto-trigger on auth.users
    - Drop the handle_new_user function
    - Rely on the atomic create_user_profile_with_qr RPC function instead
    
  3. Benefits
    - Single, consistent profile creation path
    - All required fields properly set
    - Both user_profiles AND customers created atomically
    - Better error handling and visibility
*/

-- Drop the trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function
DROP FUNCTION IF EXISTS handle_new_user();
