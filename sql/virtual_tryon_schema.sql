-- =====================================================
-- PiAPI Virtual Try-On Database Schema
-- =====================================================
-- This script creates all necessary tables for the PiAPI Virtual Try-On functionality
-- Run this script to ensure your database has all required tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CORE USER MANAGEMENT
-- =====================================================

-- Users table (for authentication and profiles)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) UNIQUE,
  role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'driver')),
  location TEXT,
  profilePhoto TEXT,
  size VARCHAR(10),
  skin_tone VARCHAR(50),
  body_width VARCHAR(50),
  coin_balance INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PRODUCT CATALOG
-- =====================================================

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Colors table
CREATE TABLE IF NOT EXISTS colors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  hex_code VARCHAR(7) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sizes table
CREATE TABLE IF NOT EXISTS sizes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  discount DECIMAL(5,2) DEFAULT 0,
  image_urls TEXT[],
  video_urls TEXT[],
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  featured_type VARCHAR(50),
  vendor_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_id UUID REFERENCES colors(id) ON DELETE SET NULL,
  size_id UUID NOT NULL REFERENCES sizes(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  price DECIMAL(10,2),
  image_urls TEXT[],
  video_urls TEXT[],
  sku VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, color_id, size_id)
);

-- =====================================================
-- VIRTUAL TRY-ON FUNCTIONALITY
-- =====================================================

-- Face swap tasks table (used for both face swap and virtual try-on)
CREATE TABLE IF NOT EXISTS face_swap_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL, -- Can be UUID or string ID
  user_image_url TEXT NOT NULL,
  product_image_url TEXT NOT NULL,
  pi_task_id TEXT, -- Stores the task_id from PiAPI response
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  task_type TEXT NOT NULL DEFAULT 'face_swap' CHECK (task_type IN ('face_swap', 'video_face_swap', 'virtual_try_on')),
  result_images TEXT[], -- Array of result image URLs
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure the constraints are properly set (in case table already exists)
DO $$
BEGIN
  -- Drop existing constraints if they exist
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'face_swap_tasks_task_type_check') THEN
    ALTER TABLE face_swap_tasks DROP CONSTRAINT face_swap_tasks_task_type_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'face_swap_tasks_status_check') THEN
    ALTER TABLE face_swap_tasks DROP CONSTRAINT face_swap_tasks_status_check;
  END IF;
  
  -- Add the constraints back
  ALTER TABLE face_swap_tasks ADD CONSTRAINT face_swap_tasks_task_type_check 
    CHECK (task_type IN ('face_swap', 'video_face_swap', 'virtual_try_on'));
    
  ALTER TABLE face_swap_tasks ADD CONSTRAINT face_swap_tasks_status_check 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
END $$;

-- User face swap results (permanent storage for virtual try-on results)
CREATE TABLE IF NOT EXISTS user_face_swap_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  result_images TEXT[] NOT NULL, -- Array of result image URLs
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one result per user per product
  UNIQUE(user_id, product_id)
);

-- =====================================================
-- COLLECTIONS AND WISHLIST
-- =====================================================

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collection products table
CREATE TABLE IF NOT EXISTS collection_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, product_id)
);

-- =====================================================
-- REVIEWS AND RATINGS
-- =====================================================

-- Product reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Product likes table
CREATE TABLE IF NOT EXISTS product_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- =====================================================
-- ORDERS
-- =====================================================

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  shipping_address TEXT,
  payment_method VARCHAR(100),
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  
  -- Product snapshot (in case product changes later)
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  product_image TEXT,
  variant_name VARCHAR(255), -- e.g., "Red - Large"
  
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Product indexes
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_featured_type ON products(featured_type);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Product variant indexes
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_color_id ON product_variants(color_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_size_id ON product_variants(size_id);

-- Face swap task indexes
CREATE INDEX IF NOT EXISTS idx_face_swap_tasks_user_id ON face_swap_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_face_swap_tasks_status ON face_swap_tasks(status);
CREATE INDEX IF NOT EXISTS idx_face_swap_tasks_pi_task_id ON face_swap_tasks(pi_task_id);
CREATE INDEX IF NOT EXISTS idx_face_swap_tasks_created_at ON face_swap_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_face_swap_tasks_task_type ON face_swap_tasks(task_type);

-- User face swap results indexes
CREATE INDEX IF NOT EXISTS idx_user_face_swap_results_user_id ON user_face_swap_results(user_id);
CREATE INDEX IF NOT EXISTS idx_user_face_swap_results_product_id ON user_face_swap_results(product_id);

-- Collection indexes
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_products_collection_id ON collection_products(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_products_product_id ON collection_products(product_id);

-- Review indexes
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);

-- Like indexes
CREATE INDEX IF NOT EXISTS idx_product_likes_user_id ON product_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_product_id ON product_likes(product_id);

-- Order indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at 
    BEFORE UPDATE ON categories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at 
    BEFORE UPDATE ON product_variants 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_face_swap_tasks_updated_at 
    BEFORE UPDATE ON face_swap_tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_face_swap_results_updated_at 
    BEFORE UPDATE ON user_face_swap_results 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at 
    BEFORE UPDATE ON collections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_reviews_updated_at 
    BEFORE UPDATE ON product_reviews 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY DISABLED
-- =====================================================
-- All RLS policies have been removed for simplified access

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE face_swap_tasks IS 'Face swap and virtual try-on tasks using PiAPI service - supports image, video, and virtual try-on operations';
COMMENT ON COLUMN face_swap_tasks.pi_task_id IS 'Task ID returned by PiAPI for status polling';
COMMENT ON COLUMN face_swap_tasks.status IS 'Current status: pending, processing, completed, failed';
COMMENT ON COLUMN face_swap_tasks.task_type IS 'Type of task: face_swap, video_face_swap, virtual_try_on';
COMMENT ON COLUMN face_swap_tasks.result_images IS 'Array of result image URLs from the API';

COMMENT ON TABLE user_face_swap_results IS 'Permanent storage for user face swap and virtual try-on results';
COMMENT ON COLUMN user_face_swap_results.result_images IS 'Array of result image URLs saved permanently for the user';

COMMENT ON TABLE users IS 'User accounts with coin balance for virtual try-on operations';
COMMENT ON COLUMN users.coin_balance IS 'User coin balance for virtual try-on and other premium features';

-- =====================================================
-- SAMPLE DATA (OPTIONAL)
-- =====================================================

-- Insert sample categories
INSERT INTO categories (id, name, description) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'Clothing', 'Fashion and apparel items'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Accessories', 'Fashion accessories and jewelry'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Shoes', 'Footwear and shoes')
ON CONFLICT (id) DO NOTHING;

-- Insert sample sizes
INSERT INTO sizes (id, name) VALUES 
  ('650e8400-e29b-41d4-a716-446655440001', 'XS'),
  ('650e8400-e29b-41d4-a716-446655440002', 'S'),
  ('650e8400-e29b-41d4-a716-446655440003', 'M'),
  ('650e8400-e29b-41d4-a716-446655440004', 'L'),
  ('650e8400-e29b-41d4-a716-446655440005', 'XL'),
  ('650e8400-e29b-41d4-a716-446655440006', 'XXL')
ON CONFLICT (id) DO NOTHING;

-- Insert sample colors
INSERT INTO colors (id, name, hex_code) VALUES 
  ('750e8400-e29b-41d4-a716-446655440001', 'Red', '#FF0000'),
  ('750e8400-e29b-41d4-a716-446655440002', 'Blue', '#0000FF'),
  ('750e8400-e29b-41d4-a716-446655440003', 'Green', '#00FF00'),
  ('750e8400-e29b-41d4-a716-446655440004', 'Black', '#000000'),
  ('750e8400-e29b-41d4-a716-446655440005', 'White', '#FFFFFF')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'users', 'categories', 'colors', 'sizes', 'products', 'product_variants',
  'face_swap_tasks', 'user_face_swap_results', 'collections', 'collection_products',
  'product_reviews', 'product_likes', 'orders', 'order_items'
)
ORDER BY table_name;

-- Verify indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN (
  'users', 'products', 'product_variants', 'face_swap_tasks', 
  'user_face_swap_results', 'collections', 'product_reviews', 'orders'
)
ORDER BY tablename, indexname;
