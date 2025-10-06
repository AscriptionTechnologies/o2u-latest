-- Fix Google Drive URLs in products table
-- This script converts Google Drive sharing URLs to direct image URLs

-- Function to convert Google Drive URL to direct URL
CREATE OR REPLACE FUNCTION convert_google_drive_url(url TEXT)
RETURNS TEXT AS $$
DECLARE
    file_id TEXT;
    clean_url TEXT;
BEGIN
    -- Remove leading @ symbol if present
    clean_url := REPLACE(url, '@', '');
    
    -- Check if it's a Google Drive URL
    IF clean_url NOT LIKE '%drive.google.com%' THEN
        RETURN url;
    END IF;
    
    -- Extract file ID from different Google Drive URL formats
    
    -- Format 1: https://drive.google.com/file/d/{fileId}/view?usp=sharing
    IF clean_url ~ '/file/d/([a-zA-Z0-9_-]+)' THEN
        file_id := (regexp_match(clean_url, '/file/d/([a-zA-Z0-9_-]+)'))[1];
    -- Format 2: https://drive.google.com/open?id={fileId}
    ELSIF clean_url ~ '[?&]id=([a-zA-Z0-9_-]+)' THEN
        file_id := (regexp_match(clean_url, '[?&]id=([a-zA-Z0-9_-]+)'))[1];
    -- Format 3: https://drive.google.com/thumbnail?id={fileId}&sz=w400
    ELSIF clean_url ~ 'thumbnail\?id=([a-zA-Z0-9_-]+)' THEN
        file_id := (regexp_match(clean_url, 'thumbnail\?id=([a-zA-Z0-9_-]+)'))[1];
    ELSE
        RETURN url; -- Return original if no pattern matches
    END IF;
    
    -- Return direct image URL
    RETURN 'https://drive.google.com/uc?export=view&id=' || file_id;
END;
$$ LANGUAGE plpgsql;

-- Update image_urls array to convert Google Drive URLs
UPDATE products 
SET image_urls = (
    SELECT array_agg(
        CASE 
            WHEN url LIKE '%drive.google.com%' THEN convert_google_drive_url(url)
            ELSE url
        END
    )
    FROM unnest(image_urls) AS url
)
WHERE EXISTS (
    SELECT 1 
    FROM unnest(image_urls) AS url 
    WHERE url LIKE '%drive.google.com%'
);

-- Update video_urls array to convert Google Drive URLs (if video_urls column exists)
-- Uncomment the following if your products table has a video_urls column
-- UPDATE products 
-- SET video_urls = (
--     SELECT array_agg(
--         CASE 
--             WHEN url LIKE '%drive.google.com%' THEN convert_google_drive_url(url)
--             ELSE url
--         END
--     )
--     FROM unnest(video_urls) AS url
-- )
-- WHERE EXISTS (
--     SELECT 1 
--     FROM unnest(video_urls) AS url 
--     WHERE url LIKE '%drive.google.com%'
-- );

-- Clean up the function
DROP FUNCTION convert_google_drive_url(TEXT);

-- Show summary of changes
SELECT 
    'Products with Google Drive URLs fixed' as message,
    COUNT(*) as count
FROM products 
WHERE 
    EXISTS (
        SELECT 1 
        FROM unnest(image_urls) AS url 
        WHERE url LIKE '%drive.google.com/uc?export=view%'
    ); 