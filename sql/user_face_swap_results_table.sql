-- Create table to store user face swap results permanently
CREATE TABLE IF NOT EXISTS user_face_swap_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  result_images TEXT[] NOT NULL, -- Array of result image URLs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one result per user per product
  UNIQUE(user_id, product_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_face_swap_results_user_id ON user_face_swap_results(user_id);
CREATE INDEX IF NOT EXISTS idx_user_face_swap_results_product_id ON user_face_swap_results(product_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE user_face_swap_results ENABLE ROW LEVEL SECURITY;

-- Users can only see their own face swap results
CREATE POLICY "Users can view their own face swap results" ON user_face_swap_results
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own face swap results
CREATE POLICY "Users can insert their own face swap results" ON user_face_swap_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own face swap results
CREATE POLICY "Users can update their own face swap results" ON user_face_swap_results
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own face swap results
CREATE POLICY "Users can delete their own face swap results" ON user_face_swap_results
  FOR DELETE USING (auth.uid() = user_id); 