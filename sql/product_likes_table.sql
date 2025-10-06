-- Create product_likes table to store user likes for products
CREATE TABLE product_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Create indexes for better performance
CREATE INDEX idx_product_likes_user_id ON product_likes(user_id);
CREATE INDEX idx_product_likes_product_id ON product_likes(product_id);
CREATE INDEX idx_product_likes_created_at ON product_likes(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE product_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_likes table
-- Users can view their own likes
CREATE POLICY "Users can view their own likes" ON product_likes
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own likes
CREATE POLICY "Users can insert their own likes" ON product_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes
CREATE POLICY "Users can delete their own likes" ON product_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can view all likes
CREATE POLICY "Admins can view all likes" ON product_likes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  ); 