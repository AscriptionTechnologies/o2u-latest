-- Add like_count column to products table
ALTER TABLE products 
ADD COLUMN like_count INTEGER DEFAULT 0;

-- Create index for better performance
CREATE INDEX idx_products_like_count ON products(like_count);

-- Function to update like count for a product
CREATE OR REPLACE FUNCTION update_product_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment like count when a new like is added
    UPDATE products 
    SET like_count = like_count + 1 
    WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement like count when a like is removed
    UPDATE products 
    SET like_count = GREATEST(like_count - 1, 0) 
    WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update like count
CREATE TRIGGER update_product_like_count_trigger
  AFTER INSERT OR DELETE ON product_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_product_like_count();

-- Update existing like counts based on current product_likes data
UPDATE products 
SET like_count = (
  SELECT COUNT(*) 
  FROM product_likes 
  WHERE product_likes.product_id = products.id
);

-- Add comment for documentation
COMMENT ON COLUMN products.like_count IS 'Number of likes for this product'; 