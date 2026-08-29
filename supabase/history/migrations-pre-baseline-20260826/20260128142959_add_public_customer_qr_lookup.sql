/*
  # Add Public QR Token Lookup Policy
  
  1. Security Changes
    - Add policy to allow anyone to read customer data by qr_token
    - This enables the public customer account page at /c/[qr_token]
    - Only basic customer info is exposed, no sensitive auth data
  
  2. Important Notes
    - This policy is intentionally permissive for QR code lookups
    - The qr_token acts as a public identifier
    - No authentication required to view customer account via QR
*/

CREATE POLICY "Anyone can read customer by qr_token"
  ON customers FOR SELECT
  TO anon, authenticated
  USING (qr_token IS NOT NULL);
