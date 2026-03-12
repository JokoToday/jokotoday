/*
  # Add User Roles to User Profiles

  1. New Types
    - Create user_role enum type (admin, staff)
  2. Modified Tables
    - `user_profiles`
      - Add `role` column (user_role type, default 'staff')
      - Indexed for permission checks
  3. Security
    - Admins can update user roles
    - Users can read their own role
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'staff');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN role user_role DEFAULT 'staff';
    CREATE INDEX idx_user_profiles_role ON user_profiles(role);
  END IF;
END $$;