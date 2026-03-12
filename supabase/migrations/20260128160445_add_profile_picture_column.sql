/*
  # Add Profile Picture Support

  1. Schema Changes
    - Add `profile_picture_url` column to `user_profiles` table
      - Stores the URL/path to the user's profile picture in Supabase Storage
      - Optional field (can be NULL)

  2. Notes
    - Profile pictures will be stored in Supabase Storage bucket 'profile-pictures'
    - Storage bucket and policies are managed through Supabase Storage API
*/

-- Add profile_picture_url column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'profile_picture_url'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN profile_picture_url text;
  END IF;
END $$;
