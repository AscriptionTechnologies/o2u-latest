-- Remove all check constraints from orders table to allow flexible values
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

-- Remove any other check constraints that might exist
DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN 
        SELECT con.conname
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'orders'
        AND con.contype = 'c'  -- 'c' is for check constraints
    LOOP
        EXECUTE format('ALTER TABLE orders DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Remove NOT NULL constraints to allow flexible data entry
ALTER TABLE orders ALTER COLUMN total_amount DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN order_number DROP NOT NULL;

-- Remove UNIQUE constraint on order_number if you want flexibility
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_key;

-- Optional: Add comments to document the change
COMMENT ON TABLE orders IS 'Orders table with flexible constraints removed for easier development';
COMMENT ON COLUMN orders.status IS 'Order status - can be any value like pending, confirmed, processing, shipped, delivered, cancelled, cod_pending, paid, etc.';
COMMENT ON COLUMN orders.payment_status IS 'Payment status - can be any value like pending, paid, failed, refunded, etc.';
COMMENT ON COLUMN orders.total_amount IS 'Total order amount - nullable for draft orders';

