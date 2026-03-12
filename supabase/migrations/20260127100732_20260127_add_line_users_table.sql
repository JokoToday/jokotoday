/*
  # Add LINE Users Table

  1. New Tables
    - `line_users` - Stores LINE user data for OAuth integration
      - `id` (uuid, primary key)
      - `line_user_id` (text, unique) - LINE's unique user ID
      - `display_name` (text) - User's display name from LINE
      - `picture_url` (text) - User's profile picture URL
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `line_users` table
    - Add policy for public read access to display names/pictures
*/

CREATE TABLE IF NOT EXISTS line_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id text UNIQUE NOT NULL,
  display_name text,
  picture_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE line_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "LINE users are publicly readable"
  ON line_users
  FOR SELECT
  TO public
  USING (true);
