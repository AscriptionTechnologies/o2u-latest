-- Insert sample reviews data for testing
-- Note: Replace the product_id with actual product IDs from your products table

-- Sample reviews for a product (replace 'your-product-id-here' with actual product ID)
INSERT INTO product_reviews (
  product_id,
  reviewer_name,
  rating,
  comment,
  is_verified,
  profile_image_url,
  created_at
) VALUES 
(
  'your-product-id-here', -- Replace with actual product ID
  'Sarah Johnson',
  5,
  'Absolutely love this saree! The fabric is so soft and the gold border work is exquisite. Perfect for special occasions.',
  true,
  'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
  NOW() - INTERVAL '2 days'
),
(
  'your-product-id-here', -- Replace with actual product ID
  'Priya Sharma',
  4,
  'Beautiful design and good quality material. The color is exactly as shown in the picture. Would definitely recommend!',
  true,
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
  NOW() - INTERVAL '5 days'
),
(
  'your-product-id-here', -- Replace with actual product ID
  'Meera Patel',
  5,
  'Stunning saree with perfect fit. The embroidery work is amazing and the fabric feels premium. Very happy with my purchase!',
  true,
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
  NOW() - INTERVAL '1 week'
),
(
  'your-product-id-here', -- Replace with actual product ID
  'Anjali Reddy',
  4,
  'Good quality saree with nice design. The delivery was fast and packaging was excellent. Will buy again!',
  false,
  NULL,
  NOW() - INTERVAL '10 days'
),
(
  'your-product-id-here', -- Replace with actual product ID
  'Kavya Singh',
  5,
  'Exceptional quality! The saree looks even better in person. The gold work is so detailed and the fabric is luxurious.',
  true,
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
  NOW() - INTERVAL '2 weeks'
);

-- You can add more reviews by copying the above pattern and changing the values
-- Make sure to replace 'your-product-id-here' with actual product IDs from your database 