-- Migration: Update order number generation from random to incremental
-- This script updates the order number generation to use incremental numbers (001, 002, 003, etc.)

-- Step 1: Drop existing trigger and function
DROP TRIGGER IF EXISTS generate_order_number_trigger ON orders;
DROP FUNCTION IF EXISTS generate_order_number();

-- Step 2: Drop and recreate the sequence
DROP SEQUENCE IF EXISTS order_number_seq;
CREATE SEQUENCE order_number_seq START 1;

-- Step 3: Update the function to use incremental sequence instead of random numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  new_order_num TEXT;
BEGIN
  -- Only generate if order_number is NULL or empty
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    -- Generate order number: ORD-YYYYMMDD-001, ORD-YYYYMMDD-002, etc.
    new_order_num := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                     LPAD(nextval('order_number_seq')::TEXT, 3, '0');
    
    NEW.order_number := new_order_num;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create the trigger
CREATE TRIGGER generate_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- Step 5: Optional - Reset sequence to continue from existing max order number
-- Uncomment and run this if you want the sequence to continue from your highest order number
/*
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(order_number FROM 16) AS INTEGER)), 
    0
  ) INTO max_num
  FROM orders 
  WHERE order_number ~ '^ORD-[0-9]{8}-[0-9]{3}$';
  
  IF max_num > 0 THEN
    PERFORM setval('order_number_seq', max_num, true);
  END IF;
END $$;
*/

