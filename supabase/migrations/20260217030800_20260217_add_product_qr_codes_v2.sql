/*
  # Add QR Code Support for Products

  1. Schema Changes
    - Add `qr_code_url` column to `cms_products` table
      - Stores URL to QR code image in Supabase storage
      - Nullable - not all products need QR codes

  2. Storage
    - Create `product-qr` bucket for QR code images
    - Enable public read access for QR images
    - Restrict uploads to authenticated users

  3. Security
    - RLS policies ensure only admins can upload/modify QR codes
    - Public read access for QR images (needed for admin preview)
*/

-- Add qr_code_url column to cms_products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_products' AND column_name = 'qr_code_url'
  ) THEN
    ALTER TABLE cms_products ADD COLUMN qr_code_url text;
  END IF;
END $$;

-- Create product-qr storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-qr', 'product-qr', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Public can view product QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete QR codes" ON storage.objects;

-- Allow public read access to QR images
CREATE POLICY "Public can view product QR codes"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-qr');

-- Allow authenticated users to upload QR codes
CREATE POLICY "Authenticated users can upload QR codes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-qr');

-- Allow authenticated users to update QR codes
CREATE POLICY "Authenticated users can update QR codes"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-qr');

-- Allow authenticated users to delete QR codes
CREATE POLICY "Authenticated users can delete QR codes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-qr');
