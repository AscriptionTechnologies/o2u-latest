-- =====================================================
-- RESET ORDER NUMBER SEQUENCE
-- This script resets the order_number_seq sequence back to start from 1
-- WARNING: This will cause new orders to start from 001 again
-- =====================================================

-- Reset sequence to 1 (next value will be 1)
-- Using 'false' means the next nextval() call will return the value we set
SELECT setval('order_number_seq', 1, false);

-- Alternative: If you want next value to be 2, use this instead:
-- SELECT setval('order_number_seq', 1, true);

-- Verification: Check the current sequence value
SELECT 
  'Sequence reset complete' AS status,
  last_value AS current_value,
  'Next order number will be: ORD-YYYYMMDD-001' AS next_value_info
FROM order_number_seq;

-- Note: After resetting, the next order will get number ORD-YYYYMMDD-001

