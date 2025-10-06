-- Fix RLS recursion issues by removing problematic admin checks
-- The issue is that policies are trying to check users.role while querying the users table

-- For orders table - remove the admin policy that causes recursion
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;

-- For product_likes table - remove the admin policy that causes recursion  
DROP POLICY IF EXISTS "Admins can view all likes" ON product_likes;

-- For product_reviews table - remove the admin policy that causes recursion
DROP POLICY IF EXISTS "Admins can manage all reviews" ON product_reviews;

-- Alternative: Create a separate admin_roles table to avoid recursion
-- CREATE TABLE admin_roles (
--   user_id UUID PRIMARY KEY REFERENCES auth.users(id),
--   role VARCHAR(50) NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- Then admin policies can check this table instead:
-- CREATE POLICY "Admins can view all orders" ON orders
--   FOR ALL USING (
--     EXISTS (
--       SELECT 1 FROM admin_roles 
--       WHERE admin_roles.user_id = auth.uid() 
--       AND admin_roles.role = 'admin'
--     )
--   );

-- For now, we'll rely on application-level admin checks instead of RLS policies
