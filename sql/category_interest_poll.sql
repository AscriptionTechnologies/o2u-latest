-- Category Interest Poll Table
-- Tracks user interest in product categories that don't have products yet

CREATE TABLE IF NOT EXISTS category_interest_poll (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  category_name VARCHAR(255) NOT NULL,
  is_interested BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_category_interest_poll_user_id ON category_interest_poll(user_id);
CREATE INDEX IF NOT EXISTS idx_category_interest_poll_category_id ON category_interest_poll(category_id);
CREATE INDEX IF NOT EXISTS idx_category_interest_poll_is_interested ON category_interest_poll(is_interested);

-- Add RLS policies
ALTER TABLE category_interest_poll ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own poll responses
CREATE POLICY "Users can view own poll responses" ON category_interest_poll
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own poll responses
CREATE POLICY "Users can insert own poll responses" ON category_interest_poll
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own poll responses
CREATE POLICY "Users can update own poll responses" ON category_interest_poll
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own poll responses
CREATE POLICY "Users can delete own poll responses" ON category_interest_poll
  FOR DELETE USING (auth.uid() = user_id);

-- Policy: Admins can view all poll responses
CREATE POLICY "Admins can view all poll responses" ON category_interest_poll
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

-- Comments
COMMENT ON TABLE category_interest_poll IS 'Stores user interest in product categories that are coming soon';
COMMENT ON COLUMN category_interest_poll.user_id IS 'Reference to the user who submitted the poll';
COMMENT ON COLUMN category_interest_poll.category_id IS 'Reference to the category the poll is about';
COMMENT ON COLUMN category_interest_poll.category_name IS 'Name of the category (cached for reporting)';
COMMENT ON COLUMN category_interest_poll.is_interested IS 'Whether the user is interested (true) or not (false)';

