/*
  # Create Product Likes System

  1. New Tables
    - `product_likes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `product_id` (uuid, references cms_products)
      - `created_at` (timestamp with time zone)
      - Unique constraint on (user_id, product_id)

  2. New Views
    - `product_like_counts` - Aggregates like counts per product

  3. Security
    - Enable RLS on `product_likes`
    - Policy for authenticated users to insert their own likes
    - Policy for authenticated users to delete their own likes
    - Policy for public read access to likes (for counts)

  4. Indexes
    - Index on product_id for fast count queries
    - Index on user_id for fast user likes lookup
*/

-- Create product_likes table
CREATE TABLE IF NOT EXISTS product_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES cms_products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Enable RLS
ALTER TABLE product_likes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can like products (insert their own likes)
CREATE POLICY "Users can like products"
  ON product_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can unlike products (delete their own likes)
CREATE POLICY "Users can unlike products"
  ON product_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Anyone can read likes (needed for like counts)
CREATE POLICY "Anyone can read likes"
  ON product_likes
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_likes_product_id ON product_likes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_user_id ON product_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_user_product ON product_likes(user_id, product_id);

-- Create view for product like counts
CREATE OR REPLACE VIEW product_like_counts AS
SELECT 
  product_id, 
  COUNT(*)::integer AS like_count
FROM product_likes
GROUP BY product_id;
