-- Blocked Users Table
-- This table stores information about users blocking other users or vendors

CREATE TABLE IF NOT EXISTS blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    blocked_vendor_name TEXT, -- For blocking vendors by name (when no vendor record exists)
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure at least one blocking method is used
    CHECK (blocked_user_id IS NOT NULL OR blocked_vendor_name IS NOT NULL),
    
    -- Prevent users from blocking themselves
    CHECK (user_id != blocked_user_id OR blocked_user_id IS NULL)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id ON blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_user_id ON blocked_users(blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_vendor_name ON blocked_users(blocked_vendor_name);

-- Enable RLS
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own blocks
CREATE POLICY "Users can view their own blocks" ON blocked_users
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own blocks
CREATE POLICY "Users can insert their own blocks" ON blocked_users
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own blocks (unblock)
CREATE POLICY "Users can delete their own blocks" ON blocked_users
    FOR DELETE USING (auth.uid() = user_id);

-- Comment: This table supports two blocking methods:
-- 1. Block by user_id: When vendor has a user account (blocked_user_id)
-- 2. Block by vendor name: When product only has vendor_name string (blocked_vendor_name)

