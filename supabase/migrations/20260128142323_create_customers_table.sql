/*
  # Create customers table

  1. New Tables
    - `customers`
      - `id` (uuid, primary key) - References auth.users.id
      - `email` (text, unique)
      - `name` (text)
      - `phone` (text)
      - `line_id` (text)
      - `whatsapp` (text)
      - `wechat_id` (text)
      - `created_at` (timestamp)
      - `qr_token` (text, unique) - For loyalty/identification
      - `loyalty_points` (integer, default 0)
      - `status` (text, default 'active')

  2. Constraints
    - Check constraint: At least one contact method (line_id, whatsapp, or wechat_id) must be present
    - Foreign key: id references auth.users(id)
    - Unique: email, qr_token

  3. Security
    - Enable RLS on `customers` table
    - Add policy for users to select their own record
    - Add policy for users to update their own record
    - Add policy for inserting own record

  4. Indexes
    - Index on email for faster lookups
    - Index on qr_token for loyalty program lookups
*/

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  line_id text,
  whatsapp text,
  wechat_id text,
  created_at timestamptz DEFAULT now(),
  qr_token text UNIQUE,
  loyalty_points integer DEFAULT 0,
  status text DEFAULT 'active',
  CONSTRAINT at_least_one_contact CHECK (
    line_id IS NOT NULL OR whatsapp IS NOT NULL OR wechat_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS customers_email_idx ON customers(email);
CREATE INDEX IF NOT EXISTS customers_qr_token_idx ON customers(qr_token);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own customer record"
  ON customers FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own customer record"
  ON customers FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own customer record"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
