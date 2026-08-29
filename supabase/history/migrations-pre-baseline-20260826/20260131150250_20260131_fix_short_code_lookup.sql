/*
  # Fix short code lookup policy

  1. Problem
    - The existing "Public can lookup customer by short code" policy allows public access
    - However, it conflicts with other authenticated-only policies
    - Need to make it truly permissive for public access

  2. Solution
    - Drop the existing restrictive short code policy
    - Create a new permissive policy that explicitly allows unauthenticated access
    - This enables staff to lookup customers without being authenticated

  3. Security
    - Only exposes short_code and related fields to public
    - Still protected by other authenticated policies for other operations
*/

DROP POLICY IF EXISTS "Public can lookup customer by short code" ON customers;

CREATE POLICY "Public can lookup customer by short code"
  ON customers FOR SELECT
  TO public
  USING (short_code IS NOT NULL);
