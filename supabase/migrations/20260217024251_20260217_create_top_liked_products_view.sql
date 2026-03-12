/*
  # Create Top Liked Products View

  1. New Views
    - `top_liked_products` - Returns top 10 products ordered by like count
    
  2. Changes
    - Joins cms_products with product_like_counts
    - Returns all product fields plus like_count
    - Ordered by like_count descending
    - Limited to top 10
    
  3. Performance
    - Leverages existing product_like_counts view
    - Single query for efficient data fetching
*/

-- Create top_liked_products view
CREATE OR REPLACE VIEW top_liked_products AS
SELECT 
  p.*,
  COALESCE(plc.like_count, 0) AS like_count
FROM cms_products p
LEFT JOIN product_like_counts plc ON p.id = plc.product_id
WHERE p.is_active = true
ORDER BY COALESCE(plc.like_count, 0) DESC, p.created_at DESC
LIMIT 10;
