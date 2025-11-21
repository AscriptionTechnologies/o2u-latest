-- Add reseller fields to orders table
-- Run this migration to enable reseller functionality

-- Add columns for reseller tracking
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS is_reseller_order BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reseller_margin_percentage NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS reseller_margin_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS original_total NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS reseller_profit NUMERIC(10,2);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_is_reseller_order ON orders(is_reseller_order);
CREATE INDEX IF NOT EXISTS idx_orders_user_reseller ON orders(user_id, is_reseller_order);

-- Add comment for documentation
COMMENT ON COLUMN orders.is_reseller_order IS 'Indicates if this order is for reselling';
COMMENT ON COLUMN orders.reseller_margin_percentage IS 'Margin percentage added by reseller';
COMMENT ON COLUMN orders.reseller_margin_amount IS 'Total margin amount in currency';
COMMENT ON COLUMN orders.original_total IS 'Original order total before reseller margin';
COMMENT ON COLUMN orders.reseller_profit IS 'Calculated profit for the reseller';

