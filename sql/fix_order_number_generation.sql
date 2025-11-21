-- =====================================================
-- COMPLETE FIX FOR ORDER NUMBER GENERATION
-- This script resets and fixes the order number generation
-- Run this on your Supabase database
-- =====================================================

-- Step 1: Drop existing trigger and function
DROP TRIGGER IF EXISTS generate_order_number_trigger ON orders;
DROP FUNCTION IF EXISTS generate_order_number();

-- Step 2: Drop and recreate the sequence (this resets the counter)
DROP SEQUENCE IF EXISTS order_number_seq;
CREATE SEQUENCE order_number_seq START 1;

-- Step 3: Make sure order_number column allows NULL (so trigger can set it)
-- Only run this if your column has NOT NULL constraint
DO $$
BEGIN
  -- Check if column has NOT NULL constraint and remove it temporarily
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'order_number' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE orders ALTER COLUMN order_number DROP NOT NULL;
  END IF;
END $$;

-- Step 4: Create the order number generation function
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

-- Step 5: Create the trigger
CREATE TRIGGER generate_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- Step 6: Update any existing NULL order numbers (before adding NOT NULL constraint)
-- This uses a CTE to assign sequential numbers, continuing from existing max
DO $$
DECLARE
  null_count INTEGER;
  max_existing_num INTEGER;
  start_num INTEGER;
BEGIN
  -- Count how many orders have NULL order numbers
  SELECT COUNT(*) INTO null_count
  FROM orders
  WHERE order_number IS NULL OR order_number = '';
  
  -- Get the maximum existing order number (last 3 digits)
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(order_number FROM 16) AS INTEGER)), 
    0
  ) INTO max_existing_num
  FROM orders 
  WHERE order_number ~ '^ORD-[0-9]{8}-[0-9]{3}$';
  
  -- Start numbering from max + 1
  start_num := max_existing_num + 1;
  
  -- If there are NULL order numbers, update them
  IF null_count > 0 THEN
    -- Use a CTE with row numbers to update existing NULL orders
    WITH numbered_orders AS (
      SELECT 
        id,
        created_at,
        (ROW_NUMBER() OVER (ORDER BY created_at) + start_num - 1) as row_num
      FROM orders
      WHERE order_number IS NULL OR order_number = ''
    )
    UPDATE orders o
    SET order_number = 'ORD-' || TO_CHAR(no.created_at, 'YYYYMMDD') || '-' || 
                       LPAD(no.row_num::TEXT, 3, '0')
    FROM numbered_orders no
    WHERE o.id = no.id;
    
    -- Update sequence to continue from the max number we just assigned
    PERFORM setval('order_number_seq', 
      (SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 16) AS INTEGER)), 0) 
       FROM orders 
       WHERE order_number ~ '^ORD-[0-9]{8}-[0-9]{3}$'), 
      true);
  ELSE
    -- Even if no NULL orders, update sequence to continue from existing max
    IF max_existing_num > 0 THEN
      PERFORM setval('order_number_seq', max_existing_num, true);
    END IF;
  END IF;
END $$;

-- Step 7: Add NOT NULL constraint back (after updating existing NULLs)
-- This ensures all new orders will have order numbers
DO $$
BEGIN
  -- Only add NOT NULL if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'order_number' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;
  END IF;
END $$;

-- Step 8: Optional - Manually reset sequence to continue from existing max order number
-- (This is already done in Step 6, but you can uncomment this if you want to reset it again)
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

-- Verification: Check sequence exists and is ready
SELECT 
  'Sequence ready: order_number_seq' AS status,
  last_value AS current_value,
  'Next order number format: ORD-YYYYMMDD-XXX' AS format_info
FROM order_number_seq;

