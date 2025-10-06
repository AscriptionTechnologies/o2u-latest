-- Safe version: Fix product_variants table relationship and structure
-- This script only creates missing tables and relationships without touching existing data

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
-- Only create if it doesn't exist to avoid data loss
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  color_id UUID,
  size_id UUID,
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

-- Add foreign key constraints only if they don't exist
DO $$ 
BEGIN
  -- Add product_id foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'product_variants_product_id_fkey' 
    AND table_name = 'product_variants'
  ) THEN
    ALTER TABLE product_variants 
    ADD CONSTRAINT product_variants_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
  END IF;

  -- Add color_id foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'product_variants_color_id_fkey' 
    AND table_name = 'product_variants'
  ) THEN
    ALTER TABLE product_variants 
    ADD CONSTRAINT product_variants_color_id_fkey 
    FOREIGN KEY (color_id) REFERENCES colors(id) ON DELETE SET NULL;
  END IF;

  -- Add size_id foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'product_variants_size_id_fkey' 
    AND table_name = 'product_variants'
  ) THEN
    ALTER TABLE product_variants 
    ADD CONSTRAINT product_variants_size_id_fkey 
    FOREIGN KEY (size_id) REFERENCES sizes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_color_id ON product_variants(color_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_size_id ON product_variants(size_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_price ON product_variants(price);

-- Insert basic sizes and colors only if tables are empty
INSERT INTO sizes (id, name) 
SELECT * FROM (VALUES 
  ('550e8400-e29b-41d4-a716-446655441001', 'XS'),
  ('550e8400-e29b-41d4-a716-446655441002', 'S'),
  ('550e8400-e29b-41d4-a716-446655441003', 'M'),
  ('550e8400-e29b-41d4-a716-446655441004', 'L'),
  ('550e8400-e29b-41d4-a716-446655441005', 'XL'),
  ('550e8400-e29b-41d4-a716-446655441006', 'XXL'),
  ('550e8400-e29b-41d4-a716-446655441007', 'Free Size')
) AS v(id, name)
WHERE NOT EXISTS (SELECT 1 FROM sizes LIMIT 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO colors (id, name, hex_code) 
SELECT * FROM (VALUES 
  ('550e8400-e29b-41d4-a716-446655442001', 'Red', '#FF0000'),
  ('550e8400-e29b-41d4-a716-446655442002', 'Blue', '#0000FF'),
  ('550e8400-e29b-41d4-a716-446655442003', 'Green', '#008000'),
  ('550e8400-e29b-41d4-a716-446655442004', 'Black', '#000000'),
  ('550e8400-e29b-41d4-a716-446655442005', 'White', '#FFFFFF'),
  ('550e8400-e29b-41d4-a716-446655442006', 'Pink', '#FFC0CB'),
  ('550e8400-e29b-41d4-a716-446655442007', 'Yellow', '#FFFF00'),
  ('550e8400-e29b-41d4-a716-446655442008', 'Purple', '#800080')
) AS v(id, name, hex_code)
WHERE NOT EXISTS (SELECT 1 FROM colors LIMIT 1)
ON CONFLICT (id) DO NOTHING;
