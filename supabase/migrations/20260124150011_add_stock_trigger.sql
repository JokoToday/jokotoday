/*
  # Add Stock Management Trigger

  1. Changes
    - Create trigger to auto-set stock_remaining = stock_total on INSERT
    - Ensures new products automatically have their remaining stock initialized
  
  2. Security
    - No RLS changes needed (trigger runs at database level)
*/

-- Create function to initialize stock_remaining
CREATE OR REPLACE FUNCTION initialize_stock_remaining()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set stock_remaining if it's NULL (new product)
  IF NEW.stock_remaining IS NULL THEN
    NEW.stock_remaining := NEW.stock_total;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for rerunning migration)
DROP TRIGGER IF EXISTS set_initial_stock ON cms_products;

-- Create trigger that fires before INSERT
CREATE TRIGGER set_initial_stock
  BEFORE INSERT ON cms_products
  FOR EACH ROW
  EXECUTE FUNCTION initialize_stock_remaining();