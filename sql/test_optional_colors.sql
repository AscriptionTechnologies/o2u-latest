-- Test script for optional colors functionality
-- This script creates test data to verify that products can work with and without colors

-- First, let's create some test colors
INSERT INTO colors (id, name, hex_code) VALUES 
('test-color-1', 'Red', '#FF0000'),
('test-color-2', 'Blue', '#0000FF'),
('test-color-3', 'Green', '#00FF00')
ON CONFLICT (id) DO NOTHING;

-- Create test sizes
INSERT INTO sizes (id, name) VALUES 
('test-size-1', 'S'),
('test-size-2', 'M'),
('test-size-3', 'L')
ON CONFLICT (id) DO NOTHING;

-- Test 1: Product with colors (traditional approach)
-- This should show color selection in the UI
INSERT INTO product_variants (id, product_id, color_id, size_id, quantity, price) VALUES 
('test-variant-1', 'your-product-id-here', 'test-color-1', 'test-size-1', 10, 2500),
('test-variant-2', 'your-product-id-here', 'test-color-2', 'test-size-1', 5, 2500),
('test-variant-3', 'your-product-id-here', 'test-color-1', 'test-size-2', 8, 2500),
('test-variant-4', 'your-product-id-here', 'test-color-2', 'test-size-2', 12, 2500)
ON CONFLICT (id) DO NOTHING;

-- Test 2: Product without colors (new approach)
-- This should NOT show color selection in the UI
INSERT INTO product_variants (id, product_id, color_id, size_id, quantity, price) VALUES 
('test-variant-5', 'your-product-id-here-2', NULL, 'test-size-1', 15, 2000),
('test-variant-6', 'your-product-id-here-2', NULL, 'test-size-2', 20, 2000),
('test-variant-7', 'your-product-id-here-2', NULL, 'test-size-3', 10, 2000)
ON CONFLICT (id) DO NOTHING;

-- Test 3: Mixed product (some variants with colors, some without)
-- This should show color selection but only for variants that have colors
INSERT INTO product_variants (id, product_id, color_id, size_id, quantity, price) VALUES 
('test-variant-8', 'your-product-id-here-3', 'test-color-1', 'test-size-1', 5, 3000),
('test-variant-9', 'your-product-id-here-3', NULL, 'test-size-2', 8, 3000),
('test-variant-10', 'your-product-id-here-3', 'test-color-3', 'test-size-3', 12, 3000)
ON CONFLICT (id) DO NOTHING;

-- Verification queries
-- Check products with colors
SELECT 
  pv.id,
  pv.product_id,
  pv.color_id,
  c.name as color_name,
  pv.size_id,
  s.name as size_name,
  pv.quantity,
  pv.price
FROM product_variants pv
LEFT JOIN colors c ON pv.color_id = c.id
LEFT JOIN sizes s ON pv.size_id = s.id
WHERE pv.product_id = 'your-product-id-here'
ORDER BY pv.size_id, pv.color_id;

-- Check products without colors
SELECT 
  pv.id,
  pv.product_id,
  pv.color_id,
  pv.size_id,
  s.name as size_name,
  pv.quantity,
  pv.price
FROM product_variants pv
LEFT JOIN sizes s ON pv.size_id = s.id
WHERE pv.product_id = 'your-product-id-here-2'
ORDER BY pv.size_id;

-- Check mixed products
SELECT 
  pv.id,
  pv.product_id,
  pv.color_id,
  c.name as color_name,
  pv.size_id,
  s.name as size_name,
  pv.quantity,
  pv.price
FROM product_variants pv
LEFT JOIN colors c ON pv.color_id = c.id
LEFT JOIN sizes s ON pv.size_id = s.id
WHERE pv.product_id = 'your-product-id-here-3'
ORDER BY pv.size_id, pv.color_id;

-- Clean up test data (uncomment when done testing)
-- DELETE FROM product_variants WHERE id LIKE 'test-variant-%';
-- DELETE FROM colors WHERE id LIKE 'test-color-%';
-- DELETE FROM sizes WHERE id LIKE 'test-size-%'; 