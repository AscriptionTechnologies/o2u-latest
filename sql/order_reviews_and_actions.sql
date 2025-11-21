-- =====================================================
-- ORDER REVIEWS AND ACTIONS SCHEMA
-- Implements Amazon-like order management functionality
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PRODUCT REVIEWS AND RATINGS
-- =====================================================

-- Product reviews table - stores reviews and ratings for products
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  
  -- Review content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  review_text TEXT,
  
  -- Review metadata
  is_verified_purchase BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  reported_count INTEGER DEFAULT 0,
  
  -- Images/media
  review_images TEXT[], -- Array of image URLs
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'hidden', 'removed')),
  moderation_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one review per user per product
  UNIQUE(user_id, product_id, order_item_id)
);

-- Review helpful votes - track which users found reviews helpful
CREATE TABLE IF NOT EXISTS review_helpful_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- =====================================================
-- RETURN AND REPLACEMENT REQUESTS
-- =====================================================

-- Return/Replacement requests table
CREATE TABLE IF NOT EXISTS order_return_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  order_number VARCHAR(50) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  
  -- Request type
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('return', 'replacement')),
  
  -- Request details
  reason VARCHAR(255) NOT NULL,
  detailed_reason TEXT,
  issue_images TEXT[], -- Array of image URLs showing the issue
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'requested' CHECK (status IN (
    'requested',
    'approved',
    'rejected',
    'pickup_scheduled',
    'picked_up',
    'in_transit',
    'received_at_warehouse',
    'inspecting',
    'refund_initiated',
    'refund_completed',
    'replacement_approved',
    'replacement_preparing',
    'replacement_shipped',
    'replacement_delivered',
    'completed',
    'cancelled'
  )),
  
  -- Refund details (for returns)
  refund_amount DECIMAL(10,2),
  refund_method VARCHAR(50), -- 'original_payment', 'wallet', 'bank_transfer'
  refund_reference VARCHAR(255),
  refund_initiated_at TIMESTAMP WITH TIME ZONE,
  refund_completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Replacement details
  replacement_order_id UUID REFERENCES orders(id),
  replacement_shipped_at TIMESTAMP WITH TIME ZONE,
  replacement_delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Pickup details
  pickup_address TEXT,
  pickup_scheduled_at TIMESTAMP WITH TIME ZONE,
  pickup_completed_at TIMESTAMP WITH TIME ZONE,
  pickup_tracking_number VARCHAR(255),
  
  -- Admin/vendor details
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  admin_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Return request status updates - timeline of status changes
CREATE TABLE IF NOT EXISTS return_request_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_request_id UUID NOT NULL REFERENCES order_return_requests(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PRODUCT AND VENDOR REPORTS
-- =====================================================

-- Product/Vendor reports table
CREATE TABLE IF NOT EXISTS product_vendor_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Report target
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('product', 'vendor')),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  
  -- Report details
  reason VARCHAR(255) NOT NULL,
  detailed_description TEXT NOT NULL,
  evidence_images TEXT[], -- Array of image URLs as evidence
  
  -- Status
  status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN (
    'submitted',
    'under_review',
    'investigating',
    'action_taken',
    'resolved',
    'dismissed',
    'escalated'
  )),
  
  -- Resolution
  resolution_notes TEXT,
  action_taken TEXT,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Priority
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report updates - timeline of actions taken
CREATE TABLE IF NOT EXISTS report_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES product_vendor_reports(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Product reviews indexes
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id ON product_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON product_reviews(status);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created_at ON product_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON product_reviews(rating);

-- Return requests indexes
CREATE INDEX IF NOT EXISTS idx_return_requests_user_id ON order_return_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON order_return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_item_id ON order_return_requests(order_item_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON order_return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_created_at ON order_return_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_return_requests_type ON order_return_requests(request_type);

-- Reports indexes
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON product_vendor_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_product_id ON product_vendor_reports(product_id);
CREATE INDEX IF NOT EXISTS idx_reports_vendor_id ON product_vendor_reports(vendor_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON product_vendor_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON product_vendor_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON product_vendor_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON product_vendor_reports(priority);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_helpful_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_request_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_vendor_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_updates ENABLE ROW LEVEL SECURITY;

-- Product reviews policies
CREATE POLICY "Users can view active reviews" ON product_reviews
  FOR SELECT USING (status = 'active' OR user_id = auth.uid());

CREATE POLICY "Users can create reviews for their purchases" ON product_reviews
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reviews" ON product_reviews
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own reviews" ON product_reviews
  FOR DELETE USING (user_id = auth.uid());

-- Review helpful votes policies
CREATE POLICY "Anyone can view helpful votes" ON review_helpful_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can vote on reviews" ON review_helpful_votes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their own votes" ON review_helpful_votes
  FOR DELETE USING (user_id = auth.uid());

-- Return requests policies
CREATE POLICY "Users can view their own return requests" ON order_return_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create return requests" ON order_return_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own pending requests" ON order_return_requests
  FOR UPDATE USING (user_id = auth.uid() AND status = 'requested');

-- Return request updates policies
CREATE POLICY "Users can view updates for their requests" ON return_request_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_return_requests
      WHERE id = return_request_updates.return_request_id
      AND user_id = auth.uid()
    )
  );

-- Product/Vendor reports policies
CREATE POLICY "Users can view their own reports" ON product_vendor_reports
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create reports" ON product_vendor_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Report updates policies
CREATE POLICY "Users can view updates for their reports" ON report_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM product_vendor_reports
      WHERE id = report_updates.report_id
      AND user_id = auth.uid()
    )
  );

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_product_reviews_updated_at
  BEFORE UPDATE ON product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_return_requests_updated_at
  BEFORE UPDATE ON order_return_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON product_vendor_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to increment helpful count on review
CREATE OR REPLACE FUNCTION increment_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE product_reviews
  SET helpful_count = helpful_count + 1
  WHERE id = NEW.review_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement helpful count on review
CREATE OR REPLACE FUNCTION decrement_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE product_reviews
  SET helpful_count = helpful_count - 1
  WHERE id = OLD.review_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Triggers for helpful votes
CREATE TRIGGER on_helpful_vote_added
  AFTER INSERT ON review_helpful_votes
  FOR EACH ROW
  EXECUTE FUNCTION increment_review_helpful_count();

CREATE TRIGGER on_helpful_vote_removed
  AFTER DELETE ON review_helpful_votes
  FOR EACH ROW
  EXECUTE FUNCTION decrement_review_helpful_count();

-- Function to automatically create update entries for return requests
CREATE OR REPLACE FUNCTION create_return_request_update()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO return_request_updates (return_request_id, status, message)
    VALUES (NEW.id, NEW.status, 'Request created');
  ELSIF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
    INSERT INTO return_request_updates (return_request_id, status, message)
    VALUES (NEW.id, NEW.status, 'Status updated to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for return request updates
CREATE TRIGGER on_return_request_change
  AFTER INSERT OR UPDATE ON order_return_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_return_request_update();

-- Function to automatically create update entries for reports
CREATE OR REPLACE FUNCTION create_report_update()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO report_updates (report_id, status, message)
    VALUES (NEW.id, NEW.status, 'Report submitted');
  ELSIF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
    INSERT INTO report_updates (report_id, status, message)
    VALUES (NEW.id, NEW.status, 'Status updated to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for report updates
CREATE TRIGGER on_report_change
  AFTER INSERT OR UPDATE ON product_vendor_reports
  FOR EACH ROW
  EXECUTE FUNCTION create_report_update();

-- =====================================================
-- VIEWS FOR ANALYTICS
-- =====================================================

-- View for product average ratings
CREATE OR REPLACE VIEW product_rating_summary AS
SELECT 
  product_id,
  COUNT(*) as review_count,
  AVG(rating)::DECIMAL(3,2) as average_rating,
  COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
  COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star_count,
  COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star_count,
  COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star_count,
  COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_count
FROM product_reviews
WHERE status = 'active'
GROUP BY product_id;

-- View for return/replacement statistics
CREATE OR REPLACE VIEW return_request_summary AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  request_type,
  status,
  COUNT(*) as request_count,
  AVG(refund_amount) as average_refund_amount
FROM order_return_requests
GROUP BY DATE_TRUNC('day', created_at), request_type, status
ORDER BY date DESC;

-- View for report statistics
CREATE OR REPLACE VIEW report_summary AS
SELECT 
  report_type,
  status,
  priority,
  COUNT(*) as report_count
FROM product_vendor_reports
GROUP BY report_type, status, priority;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE product_reviews IS 'Stores customer reviews and ratings for products';
COMMENT ON TABLE order_return_requests IS 'Tracks return and replacement requests for order items';
COMMENT ON TABLE product_vendor_reports IS 'Stores reports about products or vendors';
COMMENT ON TABLE return_request_updates IS 'Timeline of status changes for return requests';
COMMENT ON TABLE report_updates IS 'Timeline of status changes for reports';

