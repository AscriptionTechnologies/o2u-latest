-- Create product_reviews table to store product reviews
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  reviewer_name VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  date DATE DEFAULT CURRENT_DATE,
  is_verified BOOLEAN DEFAULT false,
  profile_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_rating ON product_reviews(rating);
CREATE INDEX idx_product_reviews_created_at ON product_reviews(created_at);
CREATE INDEX idx_product_reviews_is_verified ON product_reviews(is_verified);

-- Enable Row Level Security (RLS)
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_reviews table
-- Anyone can view product reviews (public)
CREATE POLICY "Anyone can view product reviews" ON product_reviews
  FOR SELECT USING (true);

-- Users can insert their own reviews
CREATE POLICY "Users can insert their own reviews" ON product_reviews
  FOR INSERT WITH CHECK (true);

-- Users can update their own reviews (if we add user_id later)
-- CREATE POLICY "Users can update their own reviews" ON product_reviews
--   FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own reviews (if we add user_id later)
-- CREATE POLICY "Users can delete their own reviews" ON product_reviews
--   FOR DELETE USING (auth.uid() = user_id);

-- Admins can manage all reviews
CREATE POLICY "Admins can manage all reviews" ON product_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Function to update product rating and review count
CREATE OR REPLACE FUNCTION update_product_review_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update product rating and review count when a new review is added
    UPDATE products 
    SET 
      rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM product_reviews 
        WHERE product_id = NEW.product_id
      ),
      reviews = (
        SELECT COUNT(*)
        FROM product_reviews 
        WHERE product_id = NEW.product_id
      )
    WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Update product rating and review count when a review is deleted
    UPDATE products 
    SET 
      rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM product_reviews 
        WHERE product_id = OLD.product_id
      ),
      reviews = (
        SELECT COUNT(*)
        FROM product_reviews 
        WHERE product_id = OLD.product_id
      )
    WHERE id = OLD.product_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update product rating when a review is updated
    UPDATE products 
    SET 
      rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM product_reviews 
        WHERE product_id = NEW.product_id
      )
    WHERE id = NEW.product_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update product stats
CREATE TRIGGER update_product_review_stats_trigger
  AFTER INSERT OR DELETE OR UPDATE ON product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_product_review_stats();

-- Add comments for documentation
COMMENT ON TABLE product_reviews IS 'Stores product reviews and ratings';
COMMENT ON COLUMN product_reviews.reviewer_name IS 'Name of the person who wrote the review';
COMMENT ON COLUMN product_reviews.rating IS 'Rating from 1 to 5 stars';
COMMENT ON COLUMN product_reviews.is_verified IS 'Whether this is a verified purchase review';
COMMENT ON COLUMN product_reviews.profile_image_url IS 'URL to reviewer profile image'; 