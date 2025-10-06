-- Update products table to support multiple images and videos
-- Option 1: Add new columns for multiple media (Recommended)
ALTER TABLE products 
ADD COLUMN image_urls TEXT[] DEFAULT '{}',
ADD COLUMN video_urls TEXT[] DEFAULT '{}';

-- Option 2: If you want to keep the old columns and add new ones
-- ALTER TABLE products 
-- ADD COLUMN image_urls TEXT[] DEFAULT '{}',
-- ADD COLUMN video_urls TEXT[] DEFAULT '{}';

-- Option 3: If you want to replace the old columns completely
-- ALTER TABLE products DROP COLUMN image_url;
-- ALTER TABLE products DROP COLUMN video_url;
-- ALTER TABLE products 
-- ADD COLUMN image_urls TEXT[] DEFAULT '{}',
-- ADD COLUMN video_urls TEXT[] DEFAULT '{}';

-- Migrate existing data from single image_url to image_urls array
UPDATE products 
SET image_urls = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND image_url != '' AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);

-- Migrate existing data from single video_url to video_urls array
UPDATE products 
SET video_urls = ARRAY[video_url] 
WHERE video_url IS NOT NULL AND video_url != '' AND (video_urls IS NULL OR array_length(video_urls, 1) IS NULL);

-- Create indexes for better performance
CREATE INDEX idx_products_image_urls ON products USING GIN (image_urls);
CREATE INDEX idx_products_video_urls ON products USING GIN (video_urls);

-- Add comments for documentation
COMMENT ON COLUMN products.image_urls IS 'Array of product image URLs';
COMMENT ON COLUMN products.video_urls IS 'Array of product video URLs'; 