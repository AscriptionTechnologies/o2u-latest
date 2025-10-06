-- Add price column to product_variants table
ALTER TABLE product_variants 
ADD COLUMN price DECIMAL(10,2) DEFAULT 0.00;

-- Update existing variants to use the product's base price
UPDATE product_variants 
SET price = (
  SELECT price 
  FROM products 
  WHERE products.id = product_variants.product_id
);

-- Make price column NOT NULL after setting default values
ALTER TABLE product_variants 
ALTER COLUMN price SET NOT NULL;

-- Add index for better performance
CREATE INDEX idx_product_variants_price ON product_variants(price); 