-- Shared Collections System
-- Allows users to share collections with others via unique share links

-- Add share_token to collections table for public sharing
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS share_token VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Create index on share_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_collections_share_token ON collections(share_token) WHERE share_token IS NOT NULL;

-- Shared collection views table - tracks who viewed/saved shared collections
CREATE TABLE IF NOT EXISTS shared_collection_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  viewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for anonymous viewers
  saved_to_wishlist BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for analytics
CREATE INDEX IF NOT EXISTS idx_shared_collection_views_collection ON shared_collection_views(collection_id);
CREATE INDEX IF NOT EXISTS idx_shared_collection_views_viewer ON shared_collection_views(viewer_user_id);

-- Function to generate unique share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 8-character alphanumeric token
    token := LOWER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM collections WHERE share_token = token) INTO exists;
    
    -- Exit loop if token is unique
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Function to enable sharing for a collection
CREATE OR REPLACE FUNCTION enable_collection_sharing(collection_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  token TEXT;
BEGIN
  -- Check if collection already has a share token
  SELECT share_token INTO token FROM collections WHERE id = collection_uuid;
  
  IF token IS NULL THEN
    -- Generate new token
    token := generate_share_token();
    
    -- Update collection with token and enable sharing
    UPDATE collections 
    SET share_token = token, 
        share_enabled = true
    WHERE id = collection_uuid;
  ELSE
    -- Just enable sharing if disabled
    UPDATE collections 
    SET share_enabled = true
    WHERE id = collection_uuid;
  END IF;
  
  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Function to disable sharing for a collection
CREATE OR REPLACE FUNCTION disable_collection_sharing(collection_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE collections 
  SET share_enabled = false
  WHERE id = collection_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_collection_views(token TEXT, viewer_id UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  col_id UUID;
BEGIN
  -- Get collection ID and increment view count
  UPDATE collections 
  SET view_count = view_count + 1
  WHERE share_token = token AND share_enabled = true
  RETURNING id INTO col_id;
  
  -- Record the view
  IF col_id IS NOT NULL THEN
    INSERT INTO shared_collection_views (collection_id, viewer_user_id)
    VALUES (col_id, viewer_id);
  END IF;
  
  RETURN col_id;
END;
$$ LANGUAGE plpgsql;

