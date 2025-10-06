-- Vendor Social Platform Schema
-- This schema creates tables for vendors, follows, and social features

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name VARCHAR(255) NOT NULL,
    description TEXT,
    profile_image_url TEXT,
    cover_image_url TEXT,
    website_url TEXT,
    instagram_handle VARCHAR(100),
    tiktok_handle VARCHAR(100),
    location VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    product_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create vendor_follows table for follow relationships
CREATE TABLE IF NOT EXISTS vendor_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, vendor_id)
);

-- Create vendor_posts table for social posts
CREATE TABLE IF NOT EXISTS vendor_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    caption TEXT,
    media_urls TEXT[],
    media_type VARCHAR(20) DEFAULT 'image', -- 'image', 'video', 'carousel'
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vendor_post_likes table
CREATE TABLE IF NOT EXISTS vendor_post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES vendor_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- Create vendor_post_comments table
CREATE TABLE IF NOT EXISTS vendor_post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES vendor_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES vendor_post_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vendor_stories table for Instagram-like stories
CREATE TABLE IF NOT EXISTS vendor_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type VARCHAR(20) DEFAULT 'image', -- 'image', 'video'
    duration INTEGER DEFAULT 5, -- seconds
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vendor_story_views table
CREATE TABLE IF NOT EXISTS vendor_story_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES vendor_stories(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(story_id, user_id)
);

-- Create vendor_highlights table for story highlights
CREATE TABLE IF NOT EXISTS vendor_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    cover_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vendor_highlight_stories table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS vendor_highlight_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    highlight_id UUID REFERENCES vendor_highlights(id) ON DELETE CASCADE,
    story_id UUID REFERENCES vendor_stories(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(highlight_id, story_id)
);

-- Create vendor_notifications table
CREATE TABLE IF NOT EXISTS vendor_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'follow', 'like', 'comment', 'mention'
    post_id UUID REFERENCES vendor_posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES vendor_post_comments(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_business_name ON vendors(business_name);
CREATE INDEX IF NOT EXISTS idx_vendor_follows_follower ON vendor_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_vendor_follows_vendor ON vendor_follows(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_posts_vendor ON vendor_posts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_posts_created_at ON vendor_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_post_likes_user ON vendor_post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_post_likes_post ON vendor_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_vendor_post_comments_post ON vendor_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_vendor_stories_vendor ON vendor_stories(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_stories_expires ON vendor_stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_vendor_notifications_vendor ON vendor_notifications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_notifications_user ON vendor_notifications(user_id);

-- Create functions to update counters
CREATE OR REPLACE FUNCTION update_vendor_follower_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE vendors SET follower_count = follower_count + 1 WHERE id = NEW.vendor_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE vendors SET follower_count = follower_count - 1 WHERE id = OLD.vendor_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_vendor_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE vendor_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE vendor_posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_vendor_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE vendor_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE vendor_posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_vendor_story_views_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE vendor_stories SET views_count = views_count + 1 WHERE id = NEW.story_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_vendor_follower_count ON vendor_follows;
CREATE TRIGGER trigger_update_vendor_follower_count
    AFTER INSERT OR DELETE ON vendor_follows
    FOR EACH ROW EXECUTE FUNCTION update_vendor_follower_count();

DROP TRIGGER IF EXISTS trigger_update_vendor_post_likes_count ON vendor_post_likes;
CREATE TRIGGER trigger_update_vendor_post_likes_count
    AFTER INSERT OR DELETE ON vendor_post_likes
    FOR EACH ROW EXECUTE FUNCTION update_vendor_post_likes_count();

DROP TRIGGER IF EXISTS trigger_update_vendor_post_comments_count ON vendor_post_comments;
CREATE TRIGGER trigger_update_vendor_post_comments_count
    AFTER INSERT OR DELETE ON vendor_post_comments
    FOR EACH ROW EXECUTE FUNCTION update_vendor_post_comments_count();

DROP TRIGGER IF EXISTS trigger_update_vendor_story_views_count ON vendor_story_views;
CREATE TRIGGER trigger_update_vendor_story_views_count
    AFTER INSERT ON vendor_story_views
    FOR EACH ROW EXECUTE FUNCTION update_vendor_story_views_count();

-- Create function to update vendor product count
CREATE OR REPLACE FUNCTION update_vendor_product_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE vendors SET product_count = product_count + 1 WHERE id = NEW.vendor_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE vendors SET product_count = product_count - 1 WHERE id = OLD.vendor_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle vendor_id changes
        IF OLD.vendor_id != NEW.vendor_id THEN
            UPDATE vendors SET product_count = product_count - 1 WHERE id = OLD.vendor_id;
            UPDATE vendors SET product_count = product_count + 1 WHERE id = NEW.vendor_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add vendor_id to products table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'vendor_id') THEN
        ALTER TABLE products ADD COLUMN vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON products(vendor_id);
        
        DROP TRIGGER IF EXISTS trigger_update_vendor_product_count ON products;
        CREATE TRIGGER trigger_update_vendor_product_count
            AFTER INSERT OR UPDATE OR DELETE ON products
            FOR EACH ROW EXECUTE FUNCTION update_vendor_product_count();
    END IF;
END $$;

-- Insert sample vendors for testing (with NULL user_id since these are just sample vendors)
-- Note: PostgreSQL allows multiple NULL values in a UNIQUE constraint
INSERT INTO vendors (user_id, business_name, description, profile_image_url, location, is_verified) VALUES
    (NULL, 'Fashion Forward', 'Trendy clothing and accessories for the modern lifestyle', 'https://example.com/vendor1.jpg', 'New York, NY', true),
    (NULL, 'Style Studio', 'Premium fashion and beauty products', 'https://example.com/vendor2.jpg', 'Los Angeles, CA', true),
    (NULL, 'Urban Threads', 'Streetwear and casual fashion', 'https://example.com/vendor3.jpg', 'Chicago, IL', false);

-- Insert sample vendor posts
INSERT INTO vendor_posts (vendor_id, product_id, caption, media_urls, media_type, is_featured) 
SELECT 
    v.id,
    p.id,
    'Check out our latest collection! Perfect for any occasion.',
    ARRAY['https://example.com/post1.jpg', 'https://example.com/post2.jpg'],
    'carousel',
    true
FROM vendors v, products p 
WHERE v.business_name = 'Fashion Forward' 
LIMIT 1;

-- Insert sample vendor stories
INSERT INTO vendor_stories (vendor_id, media_url, media_type, duration)
SELECT id, 'https://example.com/story1.jpg', 'image', 5
FROM vendors 
WHERE business_name = 'Fashion Forward';

-- Create view for vendor feed
CREATE OR REPLACE VIEW vendor_feed AS
SELECT 
    vp.id,
    vp.vendor_id,
    v.business_name,
    v.profile_image_url as vendor_profile_image,
    v.is_verified,
    vp.product_id,
    p.name as product_name,
    p.price,
    p.image_urls as product_images,
    vp.caption,
    vp.media_urls,
    vp.media_type,
    vp.likes_count,
    vp.comments_count,
    vp.shares_count,
    vp.is_featured,
    vp.created_at
FROM vendor_posts vp
JOIN vendors v ON vp.vendor_id = v.id
LEFT JOIN products p ON vp.product_id = p.id
ORDER BY vp.created_at DESC;

-- Create view for vendor profile stats
CREATE OR REPLACE VIEW vendor_profile_stats AS
SELECT 
    v.id,
    v.business_name,
    v.description,
    v.profile_image_url,
    v.cover_image_url,
    v.website_url,
    v.instagram_handle,
    v.tiktok_handle,
    v.location,
    v.is_verified,
    v.follower_count,
    v.following_count,
    v.product_count,
    COUNT(vp.id) as posts_count,
    v.created_at
FROM vendors v
LEFT JOIN vendor_posts vp ON v.id = vp.vendor_id
GROUP BY v.id, v.business_name, v.description, v.profile_image_url, v.cover_image_url, 
         v.website_url, v.instagram_handle, v.tiktok_handle, v.location, v.is_verified,
         v.follower_count, v.following_count, v.product_count, v.created_at;
