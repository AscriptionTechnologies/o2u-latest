-- Create seller_applications table for managing seller applications
CREATE TABLE IF NOT EXISTS seller_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  business_type VARCHAR(100) NOT NULL,
  business_address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(10) NOT NULL,
  gst_number VARCHAR(20),
  business_description TEXT NOT NULL,
  experience VARCHAR(255) NOT NULL,
  product_categories TEXT NOT NULL,
  expected_monthly_sales VARCHAR(100),
  website VARCHAR(255),
  social_media TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'under_review')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_seller_applications_status ON seller_applications(status);
CREATE INDEX IF NOT EXISTS idx_seller_applications_email ON seller_applications(email);
CREATE INDEX IF NOT EXISTS idx_seller_applications_created_at ON seller_applications(created_at);

-- Enable RLS
ALTER TABLE seller_applications ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own applications
CREATE POLICY "Users can insert their own applications" ON seller_applications
  FOR INSERT WITH CHECK (true);

-- Allow users to view their own applications
CREATE POLICY "Users can view their own applications" ON seller_applications
  FOR SELECT USING (email = auth.jwt() ->> 'email');

-- Allow admins to view all applications
CREATE POLICY "Admins can view all applications" ON seller_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Allow admins to update applications
CREATE POLICY "Admins can update applications" ON seller_applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_seller_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_seller_applications_updated_at
  BEFORE UPDATE ON seller_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_applications_updated_at();
