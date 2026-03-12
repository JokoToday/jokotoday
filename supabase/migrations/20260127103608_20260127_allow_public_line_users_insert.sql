/*
  # Allow public inserts to line_users table

  Adds INSERT policy to allow public users to create LINE user records for testing/demo purposes.
*/

CREATE POLICY "Anyone can create LINE users"
  ON line_users
  FOR INSERT
  TO public
  WITH CHECK (true);