/*
  # Create Collaborative Filtering Views for Product Recommendations

  1. New Views
    - `product_also_liked` - Co-like aggregation view
      - Joins product_likes to find products liked by the same users
      - Groups by product pairs and counts co-likes
    - `product_recommendations` - Ranked recommendations view
      - Ranks recommended products by co-like count
      - Partitioned by base product for efficient filtering

  2. Performance
    - Pure SQL collaborative filtering
    - No N+1 queries needed
    - Efficient ranking with window functions
    - Single query to get top recommendations

  3. Usage
    - Query product_recommendations with base_product_id filter
    - Filter by rank <= 6 to get top recommendations
*/

-- Step 1: Co-Like Aggregation View
-- Finds products that are liked by the same users
CREATE OR REPLACE VIEW product_also_liked AS
SELECT 
  pl1.product_id AS base_product_id,
  pl2.product_id AS recommended_product_id,
  COUNT(*) AS co_like_count
FROM product_likes pl1
JOIN product_likes pl2
  ON pl1.user_id = pl2.user_id
  AND pl1.product_id <> pl2.product_id
GROUP BY pl1.product_id, pl2.product_id;

-- Step 2: Ranked Recommendations View
-- Ranks recommendations by co-like count per base product
CREATE OR REPLACE VIEW product_recommendations AS
SELECT 
  base_product_id,
  recommended_product_id,
  co_like_count,
  ROW_NUMBER() OVER (
    PARTITION BY base_product_id 
    ORDER BY co_like_count DESC
  ) AS rank
FROM product_also_liked;
