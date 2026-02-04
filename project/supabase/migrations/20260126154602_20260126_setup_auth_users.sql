/*
  # Setup Auth Users Profile Table

  1. New Tables
    - `auth_users`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `auth_users` table
    - Add policies for authenticated users to read their own profile

  3. Notes
    - This table is optional but useful for storing additional user data
    - Links to Supabase's built-in auth.users table
*/

CREATE TABLE IF NOT EXISTS auth_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own auth profile"
  ON auth_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
