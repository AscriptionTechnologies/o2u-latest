-- Complete Database Schema for Only2U E-commerce App
-- This script creates the entire database from scratch
-- WARNING: This will delete all existing data!

-- Drop all existing tables (in correct order due to foreign key dependencies)
DROP TABLE IF EXISTS user_face_swap_results CASCADE;
DROP TABLE IF EXISTS create_face_swap_tasks CASCADE;
DROP TABLE IF EXISTS collection_products CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS product_likes CASCADE;
DROP TABLE IF EXISTS product_reviews CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS colors CASCADE;
DROP TABLE IF EXISTS sizes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================
-- CORE USER MANAGEMENT
-- ===========================

-- Users table (for authentication and profiles)
CREATE TABLE users (
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

-- ===========================
-- PRODUCT CATALOG
-- ===========================

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Colors table
CREATE TABLE colors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  hex_code VARCHAR(7),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sizes table
CREATE TABLE sizes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(255) UNIQUE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_urls TEXT[] DEFAULT '{}',
  video_urls TEXT[] DEFAULT '{}',
  base_price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  featured_type VARCHAR(50), -- 'trending', 'featured', 'new', etc.
  like_count INTEGER DEFAULT 0,
  return_policy TEXT,
  vendor_name VARCHAR(255),
  alias_vendor VARCHAR(255),
  tags TEXT[],
  meta_title VARCHAR(255),
  meta_description TEXT,
  stock_quantity INTEGER DEFAULT 0,
  weight DECIMAL(8,2),
  dimensions JSONB, -- {length, width, height}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product variants table (for different size/color combinations)
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_id UUID REFERENCES colors(id) ON DELETE SET NULL,
  size_id UUID REFERENCES sizes(id) ON DELETE SET NULL,
  sku VARCHAR(255) UNIQUE,
  barcode VARCHAR(255),
  price DECIMAL(10,2) NOT NULL,
  mrp_price DECIMAL(10,2),
  rsp_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  discount_percentage INTEGER DEFAULT 0,
  quantity INTEGER DEFAULT 0,
  weight DECIMAL(8,2),
  image_urls TEXT[] DEFAULT '{}',
  video_urls TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique combination of product + color + size
  UNIQUE(product_id, color_id, size_id)
);

-- ===========================
-- USER INTERACTIONS
-- ===========================

-- Product likes table
CREATE TABLE product_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Product reviews table
CREATE TABLE product_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewer_name VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_verified BOOLEAN DEFAULT false,
  profile_image_url TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User collections (wishlists, saved items)
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products in collections (many-to-many)
CREATE TABLE collection_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, product_id)
);

-- ===========================
-- ORDER MANAGEMENT
-- ===========================

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partial')),
  payment_method VARCHAR(50),
  payment_id VARCHAR(255),
  
  -- Pricing
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Addresses
  shipping_address JSONB,
  billing_address JSONB,
  
  -- Tracking
  tracking_number VARCHAR(255),
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ===========================
-- FACE SWAP FUNCTIONALITY
-- ===========================

-- Face swap tasks table
CREATE TABLE face_swap_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_image_url TEXT NOT NULL,
  product_image_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_image_url TEXT,
  error_message TEXT,
  processing_time INTEGER, -- in seconds
  api_task_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User face swap results (permanent storage)
CREATE TABLE user_face_swap_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  result_images TEXT[] NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- ===========================
-- INDEXES FOR PERFORMANCE
-- ===========================

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);

-- Category indexes
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_is_active ON categories(is_active);

-- Product indexes
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_featured_type ON products(featured_type);
CREATE INDEX idx_products_created_at ON products(created_at);
CREATE INDEX idx_products_like_count ON products(like_count);
CREATE INDEX idx_products_slug ON products(slug);

-- Product variant indexes
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_color_id ON product_variants(color_id);
CREATE INDEX idx_product_variants_size_id ON product_variants(size_id);
CREATE INDEX idx_product_variants_price ON product_variants(price);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);

-- Product interaction indexes
CREATE INDEX idx_product_likes_user_id ON product_likes(user_id);
CREATE INDEX idx_product_likes_product_id ON product_likes(product_id);
CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_user_id ON product_reviews(user_id);
CREATE INDEX idx_product_reviews_rating ON product_reviews(rating);

-- Collection indexes
CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_collection_products_collection_id ON collection_products(collection_id);
CREATE INDEX idx_collection_products_product_id ON collection_products(product_id);

-- Order indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Face swap indexes
CREATE INDEX idx_face_swap_tasks_user_id ON face_swap_tasks(user_id);
CREATE INDEX idx_face_swap_tasks_status ON face_swap_tasks(status);
CREATE INDEX idx_user_face_swap_results_user_id ON user_face_swap_results(user_id);

-- ===========================
-- ROW LEVEL SECURITY (RLS)
-- ===========================

-- Enable RLS on all user-specific tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_swap_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_face_swap_results ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own profile
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Allow user creation during signup" ON users
  FOR INSERT WITH CHECK (true);

-- Product likes policies
CREATE POLICY "Users can view their own likes" ON product_likes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own likes" ON product_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON product_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Product reviews policies
CREATE POLICY "Anyone can view product reviews" ON product_reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own reviews" ON product_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" ON product_reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- Collections policies
CREATE POLICY "Users can manage their own collections" ON collections
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own collection products" ON collection_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM collections 
      WHERE collections.id = collection_products.collection_id 
      AND collections.user_id = auth.uid()
    )
  );

-- Orders policies
CREATE POLICY "Users can view their own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own order items" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.user_id = auth.uid()
    )
  );

-- Face swap policies
CREATE POLICY "Users can manage their own face swap tasks" ON face_swap_tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own face swap results" ON user_face_swap_results
  FOR ALL USING (auth.uid() = user_id);

-- ===========================
-- FUNCTIONS AND TRIGGERS
-- ===========================

-- Function to update like count for products
CREATE OR REPLACE FUNCTION update_product_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE products 
    SET like_count = like_count + 1 
    WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE products 
    SET like_count = GREATEST(like_count - 1, 0) 
    WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for like count updates
CREATE TRIGGER update_product_like_count_trigger
  AFTER INSERT OR DELETE ON product_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_product_like_count();

-- Create sequence for incremental order numbers
DROP SEQUENCE IF EXISTS order_number_seq;
CREATE SEQUENCE order_number_seq START 1;

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  new_order_num TEXT;
BEGIN
  -- Only generate if order_number is NULL or empty
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    -- Generate order number: ORD-YYYYMMDD-001, ORD-YYYYMMDD-002, etc.
    new_order_num := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                     LPAD(nextval('order_number_seq')::text, 3, '0');
    
    NEW.order_number := new_order_num;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for order number generation
DROP TRIGGER IF EXISTS generate_order_number_trigger ON orders;
CREATE TRIGGER generate_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================
-- SAMPLE DATA
-- ===========================

-- Insert default categories
INSERT INTO categories (id, name, slug, description) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'Sarees', 'sarees', 'Traditional Indian sarees'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Lehengas', 'lehengas', 'Designer lehenga cholis'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Tops', 'tops', 'Fashionable tops and blouses'),
  ('550e8400-e29b-41d4-a716-446655440004', 'Bottom Wear', 'bottom-wear', 'Pants, jeans, and bottoms'),
  ('550e8400-e29b-41d4-a716-446655440005', 'Night Wear', 'night-wear', 'Comfortable nightwear'),
  ('550e8400-e29b-41d4-a716-446655440006', 'Dupatta', 'dupatta', 'Beautiful dupattas and scarves'),
  ('550e8400-e29b-41d4-a716-446655440007', '3pc Set', '3pc-set', 'Complete three-piece sets'),
  ('550e8400-e29b-41d4-a716-446655440008', 'Ready Made', 'ready-made', 'Ready-to-wear clothing'),
  ('550e8400-e29b-41d4-a716-446655440009', 'Pattu Saree', 'pattu-saree', 'Silk pattu sarees'),
  ('550e8400-e29b-41d4-a716-446655440010', 'Plazo Set', 'plazo-set', 'Stylish plazo sets');

-- Insert standard sizes
INSERT INTO sizes (id, name, sort_order) VALUES 
  ('550e8400-e29b-41d4-a716-446655441001', 'XS', 1),
  ('550e8400-e29b-41d4-a716-446655441002', 'S', 2),
  ('550e8400-e29b-41d4-a716-446655441003', 'M', 3),
  ('550e8400-e29b-41d4-a716-446655441004', 'L', 4),
  ('550e8400-e29b-41d4-a716-446655441005', 'XL', 5),
  ('550e8400-e29b-41d4-a716-446655441006', 'XXL', 6),
  ('550e8400-e29b-41d4-a716-446655441007', 'Free Size', 7);

-- Insert standard colors
INSERT INTO colors (id, name, hex_code) VALUES 
  ('550e8400-e29b-41d4-a716-446655442001', 'Red', '#FF0000'),
  ('550e8400-e29b-41d4-a716-446655442002', 'Blue', '#0000FF'),
  ('550e8400-e29b-41d4-a716-446655442003', 'Green', '#008000'),
  ('550e8400-e29b-41d4-a716-446655442004', 'Black', '#000000'),
  ('550e8400-e29b-41d4-a716-446655442005', 'White', '#FFFFFF'),
  ('550e8400-e29b-41d4-a716-446655442006', 'Pink', '#FFC0CB'),
  ('550e8400-e29b-41d4-a716-446655442007', 'Yellow', '#FFFF00'),
  ('550e8400-e29b-41d4-a716-446655442008', 'Purple', '#800080'),
  ('550e8400-e29b-41d4-a716-446655442009', 'Orange', '#FFA500'),
  ('550e8400-e29b-41d4-a716-446655442010', 'Maroon', '#800000');

-- Success message
SELECT 'Database schema created successfully! 🎉' as status;
