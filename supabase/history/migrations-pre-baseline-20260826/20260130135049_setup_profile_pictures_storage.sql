/*
  # Set up profile pictures storage

  1. Storage Setup
    - Create `profile-pictures` storage bucket
    - Configure bucket to be public
    - Set file size limit to 5MB
    - Allow only image file types
  
  2. Security
    - Enable RLS on the storage bucket
    - Add policy for authenticated users to upload their own profile pictures
    - Add policy for authenticated users to read any profile picture
    - Add policy for authenticated users to delete their own profile pictures
  
  3. Notes
    - Profile pictures are stored in user-specific folders: `{user_id}/{filename}`
    - Old profile pictures are not automatically deleted when new ones are uploaded
    - Max file size: 5MB
*/

-- Create profile-pictures storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
DO $$
BEGIN
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can upload their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile pictures" ON storage.objects;

-- Policy: Allow authenticated users to upload their own profile pictures
CREATE POLICY "Users can upload their own profile pictures"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-pictures' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow anyone to read profile pictures (they are public)
CREATE POLICY "Anyone can view profile pictures"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-pictures');

-- Policy: Allow authenticated users to update their own profile pictures
CREATE POLICY "Users can update their own profile pictures"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow authenticated users to delete their own profile pictures
CREATE POLICY "Users can delete their own profile pictures"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
