-- Migration: Create coupons table
-- Description: Adds a coupons table for managing promotional codes within the admin panel
-- Generated: 2025-11-09

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses >= 0),
  uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  per_user_limit INTEGER CHECK (per_user_limit IS NULL OR per_user_limit >= 0),
  min_order_value NUMERIC(10, 2) CHECK (min_order_value IS NULL OR min_order_value >= 0),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes to speed up lookups and filtering
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons (code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons (is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_start_end ON coupons (start_date, end_date);

-- Comment for documentation
COMMENT ON TABLE coupons IS 'Stores promotional coupon codes with metadata and usage tracking.';

-- Create coupon_usage table to track per-user usage
CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  discount_amount NUMERIC(10, 2) NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(coupon_id, user_id, order_id)
);

-- Indexes for coupon_usage
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id ON coupon_usage (coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id ON coupon_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order_id ON coupon_usage (order_id);

COMMENT ON TABLE coupon_usage IS 'Tracks individual coupon usage by users for order history and per-user limits.';

-- Function to automatically update uses_count when coupon is used
CREATE OR REPLACE FUNCTION increment_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE coupons
  SET uses_count = uses_count + 1
  WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment uses_count
CREATE TRIGGER trigger_increment_coupon_usage
AFTER INSERT ON coupon_usage
FOR EACH ROW
EXECUTE FUNCTION increment_coupon_usage();

-- Insert sample coupons for testing
INSERT INTO coupons (code, description, discount_type, discount_value, max_uses, per_user_limit, min_order_value, is_active) VALUES
  ('SAVE10', '10% off on all orders', 'percentage', 10, NULL, NULL, 0, TRUE),
  ('SAVE20', '20% off on orders above ₹500', 'percentage', 20, NULL, 3, 500, TRUE),
  ('NEW50', 'Flat ₹50 off for new users', 'fixed', 50, NULL, 1, 0, TRUE),
  ('NEW100', 'Flat ₹100 off on first order', 'fixed', 100, NULL, 1, 300, TRUE),
  ('FIRST200', 'First order special - ₹200 off', 'fixed', 200, 100, 1, 500, TRUE),
  ('FLAT300', 'Flat ₹300 off on orders above ₹1000', 'fixed', 300, NULL, NULL, 1000, TRUE),
  ('MEGA500', 'Mega sale - ₹500 off on orders above ₹2000', 'fixed', 500, 50, NULL, 2000, TRUE),
  ('WELCOME15', '15% off welcome offer', 'percentage', 15, NULL, 2, 200, TRUE)
ON CONFLICT (code) DO NOTHING;

SELECT 'Coupons table and sample data created successfully' AS status;

