-- Temporarily disable RLS on users table to fix infinite recursion
-- This allows the auth context to fetch user data properly

-- Disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- OR if you want to keep RLS enabled, create a simple policy that doesn't reference itself
-- DROP ALL EXISTING POLICIES first if they exist
-- DROP POLICY IF EXISTS "Users can view their own profile" ON users;
-- DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Enable RLS
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create simple policies that don't cause recursion
-- CREATE POLICY "Users can view their own profile" ON users
--   FOR SELECT USING (auth.uid() = id);

-- CREATE POLICY "Users can update their own profile" ON users
--   FOR UPDATE USING (auth.uid() = id);

-- CREATE POLICY "Allow user creation during signup" ON users
--   FOR INSERT WITH CHECK (true);
