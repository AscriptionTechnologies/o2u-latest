-- Fix product_variants table relationship and structure
-- This script ensures the proper relationship between products and product_variants exists

-- First, create the base tables that don't have dependencies

-- Ensure products table exists (basic structure)
-- Note: This won't override if it already exists with different structure
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID,
  image_urls TEXT[] DEFAULT '{}',
  video_urls TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  featured_type VARCHAR(50),
  like_count INTEGER DEFAULT 0,
  return_policy TEXT,
  vendor_name VARCHAR(255),
  alias_vendor VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categories table if it doesn't exist
-- Note: This will only create if table doesn't exist, preserving existing structure
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create colors table if it doesn't exist
CREATE TABLE IF NOT EXISTS colors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  hex_code VARCHAR(7),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sizes table if it doesn't exist
CREATE TABLE IF NOT EXISTS sizes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Now create product_variants table with proper foreign key references
-- Drop the table first if it exists to recreate with proper structure
DROP TABLE IF EXISTS product_variants;

CREATE TABLE product_variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_id UUID REFERENCES colors(id) ON DELETE SET NULL,
  size_id UUID REFERENCES sizes(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 0,
  price DECIMAL(10,2),
  sku VARCHAR(255),
  mrp_price DECIMAL(10,2),
  rsp_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  discount_percentage INTEGER DEFAULT 0,
  image_urls TEXT[] DEFAULT '{}',
  video_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint for category_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'products_category_id_fkey' 
    AND table_name = 'products'
  ) THEN
    ALTER TABLE products 
    ADD CONSTRAINT products_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_color_id ON product_variants(color_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_size_id ON product_variants(size_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_price ON product_variants(price);

-- Insert some basic data if tables are empty
-- First, let's check what columns exist in categories table and insert accordingly
DO $$
BEGIN
  -- Try to insert with slug column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'slug'
  ) THEN
    INSERT INTO categories (id, name, slug) VALUES 
      ('550e8400-e29b-41d4-a716-446655440001', 'Sarees', 'sarees'),
      ('550e8400-e29b-41d4-a716-446655440002', 'Lehengas', 'lehengas'),
      ('550e8400-e29b-41d4-a716-446655440003', 'Tops', 'tops'),
      ('550e8400-e29b-41d4-a716-446655440004', 'Bottom Wear', 'bottom-wear'),
      ('550e8400-e29b-41d4-a716-446655440005', 'Night Wear', 'night-wear'),
      ('550e8400-e29b-41d4-a716-446655440006', 'Dupatta', 'dupatta'),
      ('550e8400-e29b-41d4-a716-446655440007', '3pc Set', '3pc-set'),
      ('550e8400-e29b-41d4-a716-446655440008', 'Ready Made', 'ready-made'),
      ('550e8400-e29b-41d4-a716-446655440009', 'Pattu Saree', 'pattu-saree'),
      ('550e8400-e29b-41d4-a716-446655440010', 'Plazo Set', 'plazo-set')
    ON CONFLICT (id) DO NOTHING;
  ELSE
    -- Insert without slug if column doesn't exist
    INSERT INTO categories (id, name) VALUES 
      ('550e8400-e29b-41d4-a716-446655440001', 'Sarees'),
      ('550e8400-e29b-41d4-a716-446655440002', 'Lehengas'),
      ('550e8400-e29b-41d4-a716-446655440003', 'Tops'),
      ('550e8400-e29b-41d4-a716-446655440004', 'Bottom Wear'),
      ('550e8400-e29b-41d4-a716-446655440005', 'Night Wear'),
      ('550e8400-e29b-41d4-a716-446655440006', 'Dupatta'),
      ('550e8400-e29b-41d4-a716-446655440007', '3pc Set'),
      ('550e8400-e29b-41d4-a716-446655440008', 'Ready Made'),
      ('550e8400-e29b-41d4-a716-446655440009', 'Pattu Saree'),
      ('550e8400-e29b-41d4-a716-446655440010', 'Plazo Set')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

INSERT INTO sizes (id, name) VALUES 
  ('550e8400-e29b-41d4-a716-446655441001', 'XS'),
  ('550e8400-e29b-41d4-a716-446655441002', 'S'),
  ('550e8400-e29b-41d4-a716-446655441003', 'M'),
  ('550e8400-e29b-41d4-a716-446655441004', 'L'),
  ('550e8400-e29b-41d4-a716-446655441005', 'XL'),
  ('550e8400-e29b-41d4-a716-446655441006', 'XXL'),
  ('550e8400-e29b-41d4-a716-446655441007', 'Free Size')
ON CONFLICT (id) DO NOTHING;

INSERT INTO colors (id, name, hex_code) VALUES 
  ('550e8400-e29b-41d4-a716-446655442001', 'Red', '#FF0000'),
  ('550e8400-e29b-41d4-a716-446655442002', 'Blue', '#0000FF'),
  ('550e8400-e29b-41d4-a716-446655442003', 'Green', '#008000'),
  ('550e8400-e29b-41d4-a716-446655442004', 'Black', '#000000'),
  ('550e8400-e29b-41d4-a716-446655442005', 'White', '#FFFFFF'),
  ('550e8400-e29b-41d4-a716-446655442006', 'Pink', '#FFC0CB'),
  ('550e8400-e29b-41d4-a716-446655442007', 'Yellow', '#FFFF00'),
  ('550e8400-e29b-41d4-a716-446655442008', 'Purple', '#800080')
ON CONFLICT (id) DO NOTHING;

-- Add some sample product variants to test the relationship
-- This will only work if you have existing products
DO $$
BEGIN
  -- Check if we have any products first
  IF EXISTS (SELECT 1 FROM products LIMIT 1) THEN
    -- Add a sample product variant for testing
    INSERT INTO product_variants (
      product_id, 
      color_id, 
      size_id, 
      quantity, 
      price, 
      sku, 
      mrp_price, 
      rsp_price
    ) 
    SELECT 
      p.id,
      c.id,
      s.id,
      10,
      999.99,
      'TEST-SKU-001',
      1299.99,
      899.99
    FROM products p
    CROSS JOIN colors c
    CROSS JOIN sizes s
    WHERE c.name = 'Red' 
      AND s.name = 'M'
    LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;
END $$;