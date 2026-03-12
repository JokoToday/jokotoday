/*
  # Fix profile pictures storage access

  1. Issue
    - Profile pictures were not readable due to incorrect RLS policy setup
    - Need to fix public access for viewing profile pictures

  2. Changes
    - Drop and recreate the public read policy with proper settings
    - Ensure the bucket configuration allows public reads
*/

DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;

-- Create new policy that allows public read access
CREATE POLICY "Anyone can view profile pictures"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'profile-pictures');
