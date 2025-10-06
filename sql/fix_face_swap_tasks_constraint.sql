-- =====================================================
-- Fix face_swap_tasks task_type constraint
-- =====================================================
-- This script fixes the task_type check constraint to ensure it matches the code expectations

SELECT 
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid, true) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE t.relname = 'face_swap_tasks'
  AND c.conname LIKE '%face_swap_tasks_task_type_check%';

-- Drop the existing constraint if it exists
ALTER TABLE face_swap_tasks DROP CONSTRAINT IF EXISTS face_swap_tasks_task_type_check;

-- Recreate the constraint with the correct values
ALTER TABLE face_swap_tasks 
ADD CONSTRAINT face_swap_tasks_task_type_check 
CHECK (task_type IN ('face_swap', 'video_face_swap', 'virtual_try_on'));

-- Also fix the status constraint to be safe
ALTER TABLE face_swap_tasks DROP CONSTRAINT IF EXISTS face_swap_tasks_status_check;

ALTER TABLE face_swap_tasks 
ADD CONSTRAINT face_swap_tasks_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- Verify the constraints were created correctly
SELECT 
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid, true) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE t.relname = 'face_swap_tasks'
  AND c.conname LIKE '%face_swap_tasks%check%'
ORDER BY c.conname;

-- Test insert to verify the constraint works
-- This should succeed
-- Note: omit user_id to avoid FK errors if no such user exists
INSERT INTO face_swap_tasks (
    product_id, 
    user_image_url, 
    product_image_url, 
    task_type
) VALUES (
    'test-product',
    'https://example.com/user.jpg',
    'https://example.com/product.jpg',
    'virtual_try_on'
) ON CONFLICT DO NOTHING;

-- Clean up the test record
DELETE FROM face_swap_tasks WHERE product_id = 'test-product';

-- Show final verification
SELECT 'Constraints fixed successfully' as status;
