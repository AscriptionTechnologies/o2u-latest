-- Reseller System Database Schema
-- This script creates tables for the reseller system similar to Meesho

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================
-- RESELLER SYSTEM TABLES
-- ===========================

-- Resellers table - stores information about users who can resell products
CREATE TABLE resellers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255),
  business_type VARCHAR(100), -- 'individual', 'business', 'retailer'
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  gst_number VARCHAR(15),
  pan_number VARCHAR(10),
  bank_account_number VARCHAR(20),
  ifsc_code VARCHAR(11),
  account_holder_name VARCHAR(255),
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  commission_rate DECIMAL(5,2) DEFAULT 10.00, -- Default 10% commission
  total_earnings DECIMAL(12,2) DEFAULT 0.00,
  total_orders INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Reseller products table - products that resellers can sell
CREATE TABLE reseller_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  base_price DECIMAL(10,2) NOT NULL, -- Original product price
  margin_percentage DECIMAL(5,2) DEFAULT 15.00, -- Reseller's margin (default 15%)
  selling_price DECIMAL(10,2) NOT NULL, -- Final price after adding margin
  commission_percentage DECIMAL(5,2) DEFAULT 10.00, -- Commission to platform
  is_active BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT 0,
  minimum_order_quantity INTEGER DEFAULT 1,
  maximum_order_quantity INTEGER DEFAULT 100,
  catalog_images TEXT[] DEFAULT '{}', -- Custom catalog images for sharing
  custom_description TEXT, -- Custom description for reseller's catalog
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(reseller_id, product_id, variant_id)
);

-- Reseller catalog shares table - tracks when resellers share product catalogs
CREATE TABLE reseller_catalog_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  share_method VARCHAR(50) NOT NULL, -- 'whatsapp', 'telegram', 'instagram', 'facebook', 'direct_link'
  share_content TEXT, -- The content that was shared
  share_metadata JSONB, -- Additional metadata about the share
  recipient_count INTEGER DEFAULT 1, -- Number of people the catalog was shared with
  views INTEGER DEFAULT 0, -- Number of views from the shared catalog
  clicks INTEGER DEFAULT 0, -- Number of clicks on shared links
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reseller orders table - orders placed through resellers
CREATE TABLE reseller_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  reseller_id UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(255),
  customer_address TEXT NOT NULL,
  customer_city VARCHAR(100) NOT NULL,
  customer_state VARCHAR(100) NOT NULL,
  customer_pincode VARCHAR(10) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  reseller_commission DECIMAL(10,2) NOT NULL,
  platform_commission DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
  payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
  payment_method VARCHAR(50), -- 'cod', 'online', 'upi', 'card'
  notes TEXT,
  tracking_number VARCHAR(100),
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reseller order items table - individual items in reseller orders
CREATE TABLE reseller_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES reseller_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  reseller_price DECIMAL(10,2) NOT NULL, -- Price reseller bought at
  margin_amount DECIMAL(10,2) NOT NULL, -- Profit margin for reseller
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reseller earnings table - tracks earnings and commissions
CREATE TABLE reseller_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES reseller_orders(id) ON DELETE CASCADE,
  earning_type VARCHAR(50) NOT NULL, -- 'commission', 'bonus', 'referral'
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reseller analytics table - tracks performance metrics
CREATE TABLE reseller_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  products_viewed INTEGER DEFAULT 0,
  catalogs_shared INTEGER DEFAULT 0,
  orders_received INTEGER DEFAULT 0,
  revenue_generated DECIMAL(12,2) DEFAULT 0.00,
  commission_earned DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(reseller_id, date)
);

-- ===========================
-- INDEXES FOR PERFORMANCE
-- ===========================

-- Resellers indexes
CREATE INDEX IF NOT EXISTS idx_resellers_user_id ON resellers(user_id);
CREATE INDEX IF NOT EXISTS idx_resellers_is_active ON resellers(is_active);
CREATE INDEX IF NOT EXISTS idx_resellers_created_at ON resellers(created_at);

-- Reseller products indexes
CREATE INDEX IF NOT EXISTS idx_reseller_products_reseller_id ON reseller_products(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_products_product_id ON reseller_products(product_id);
CREATE INDEX IF NOT EXISTS idx_reseller_products_is_active ON reseller_products(is_active);
CREATE INDEX IF NOT EXISTS idx_reseller_products_selling_price ON reseller_products(selling_price);

-- Reseller catalog shares indexes
CREATE INDEX IF NOT EXISTS idx_catalog_shares_reseller_id ON reseller_catalog_shares(reseller_id);
CREATE INDEX IF NOT EXISTS idx_catalog_shares_product_id ON reseller_catalog_shares(product_id);
CREATE INDEX IF NOT EXISTS idx_catalog_shares_created_at ON reseller_catalog_shares(created_at);

-- Reseller orders indexes
CREATE INDEX IF NOT EXISTS idx_reseller_orders_reseller_id ON reseller_orders(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_customer_id ON reseller_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_status ON reseller_orders(status);
CREATE INDEX IF NOT EXISTS idx_reseller_orders_created_at ON reseller_orders(created_at);

-- Reseller order items indexes
CREATE INDEX IF NOT EXISTS idx_reseller_order_items_order_id ON reseller_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reseller_order_items_product_id ON reseller_order_items(product_id);

-- Reseller earnings indexes
CREATE INDEX IF NOT EXISTS idx_earnings_reseller_id ON reseller_earnings(reseller_id);
CREATE INDEX IF NOT EXISTS idx_earnings_order_id ON reseller_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_earnings_status ON reseller_earnings(status);

-- Reseller analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_reseller_id ON reseller_analytics(reseller_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON reseller_analytics(date);

-- ===========================
-- FUNCTIONS AND TRIGGERS
-- ===========================

-- Function to calculate selling price based on margin
CREATE OR REPLACE FUNCTION calculate_selling_price()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate selling price: base_price + (base_price * margin_percentage / 100)
  NEW.selling_price = NEW.base_price + (NEW.base_price * NEW.margin_percentage / 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate selling price
DROP TRIGGER IF EXISTS trigger_calculate_selling_price ON reseller_products;
CREATE TRIGGER trigger_calculate_selling_price
  BEFORE INSERT OR UPDATE ON reseller_products
  FOR EACH ROW
  EXECUTE FUNCTION calculate_selling_price();

-- Function to update reseller analytics
CREATE OR REPLACE FUNCTION update_reseller_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert analytics for the day
  INSERT INTO reseller_analytics (
    reseller_id,
    date,
    orders_received,
    revenue_generated,
    commission_earned
  )
  VALUES (
    NEW.reseller_id,
    CURRENT_DATE,
    1,
    NEW.total_amount,
    NEW.reseller_commission
  )
  ON CONFLICT (reseller_id, date)
  DO UPDATE SET
    orders_received = reseller_analytics.orders_received + 1,
    revenue_generated = reseller_analytics.revenue_generated + NEW.total_amount,
    commission_earned = reseller_analytics.commission_earned + NEW.reseller_commission;
  
  -- Update reseller totals
  UPDATE resellers 
  SET 
    total_orders = total_orders + 1,
    total_earnings = total_earnings + NEW.reseller_commission,
    updated_at = NOW()
  WHERE id = NEW.reseller_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update analytics when order is delivered
DROP TRIGGER IF EXISTS trigger_update_reseller_analytics ON reseller_orders;
CREATE TRIGGER trigger_update_reseller_analytics
  AFTER UPDATE OF status ON reseller_orders
  FOR EACH ROW
  WHEN (NEW.status = 'delivered' AND OLD.status != 'delivered')
  EXECUTE FUNCTION update_reseller_analytics();

-- ===========================
-- ROW LEVEL SECURITY (RLS)
-- ===========================

-- Enable RLS on reseller tables
ALTER TABLE resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_catalog_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for resellers table
DROP POLICY IF EXISTS "Users can view their own reseller profile" ON resellers;
CREATE POLICY "Users can view their own reseller profile" ON resellers
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own reseller profile" ON resellers;
CREATE POLICY "Users can insert their own reseller profile" ON resellers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reseller profile" ON resellers;
CREATE POLICY "Users can update their own reseller profile" ON resellers
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for reseller_products table
DROP POLICY IF EXISTS "Resellers can manage their own products" ON reseller_products;
CREATE POLICY "Resellers can manage their own products" ON reseller_products
  FOR ALL USING (
    reseller_id IN (
      SELECT id FROM resellers WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for reseller_catalog_shares table
DROP POLICY IF EXISTS "Resellers can manage their own catalog shares" ON reseller_catalog_shares;
CREATE POLICY "Resellers can manage their own catalog shares" ON reseller_catalog_shares
  FOR ALL USING (
    reseller_id IN (
      SELECT id FROM resellers WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for reseller_orders table
DROP POLICY IF EXISTS "Resellers can view their own orders" ON reseller_orders;
CREATE POLICY "Resellers can view their own orders" ON reseller_orders
  FOR SELECT USING (
    reseller_id IN (
      SELECT id FROM resellers WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for reseller_order_items table
DROP POLICY IF EXISTS "Resellers can view their own order items" ON reseller_order_items;
CREATE POLICY "Resellers can view their own order items" ON reseller_order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM reseller_orders WHERE reseller_id IN (
        SELECT id FROM resellers WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for reseller_earnings table
DROP POLICY IF EXISTS "Resellers can view their own earnings" ON reseller_earnings;
CREATE POLICY "Resellers can view their own earnings" ON reseller_earnings
  FOR SELECT USING (
    reseller_id IN (
      SELECT id FROM resellers WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for reseller_analytics table
DROP POLICY IF EXISTS "Resellers can view their own analytics" ON reseller_analytics;
CREATE POLICY "Resellers can view their own analytics" ON reseller_analytics
  FOR SELECT USING (
    reseller_id IN (
      SELECT id FROM resellers WHERE user_id = auth.uid()
    )
  );

-- ===========================
-- SAMPLE DATA (Optional)
-- ===========================

-- You can uncomment this section to insert sample data for testing

-- INSERT INTO resellers (user_id, business_name, business_type, phone, is_verified)
-- SELECT 
--   u.id,
--   u.name || ' Store',
--   'individual',
--   u.phone,
--   true
-- FROM users u
-- WHERE u.role = 'customer'
-- LIMIT 5;

-- ===========================
-- COMMENTS
-- ===========================

COMMENT ON TABLE resellers IS 'Stores information about users who can resell products';
COMMENT ON TABLE reseller_products IS 'Products that resellers can sell with custom pricing';
COMMENT ON TABLE reseller_catalog_shares IS 'Tracks when resellers share product catalogs';
COMMENT ON TABLE reseller_orders IS 'Orders placed through resellers';
COMMENT ON TABLE reseller_order_items IS 'Individual items in reseller orders';
COMMENT ON TABLE reseller_earnings IS 'Tracks earnings and commissions for resellers';
COMMENT ON TABLE reseller_analytics IS 'Daily analytics for reseller performance';

COMMENT ON COLUMN resellers.commission_rate IS 'Default commission rate for the reseller (%)';
COMMENT ON COLUMN reseller_products.margin_percentage IS 'Reseller profit margin (%)';
COMMENT ON COLUMN reseller_products.selling_price IS 'Final price after adding margin';
COMMENT ON COLUMN reseller_products.commission_percentage IS 'Platform commission (%)';
