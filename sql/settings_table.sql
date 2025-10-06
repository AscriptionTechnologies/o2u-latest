-- Create settings table for dynamic configuration
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert Razorpay configuration
INSERT INTO settings (key, value, description) VALUES 
('razorpay_key_id', 'rzp_test_RJTvncgwxkUdWE', 'Razorpay Key ID for payment processing')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Insert other common settings
INSERT INTO settings (key, value, description) VALUES 
('app_name', 'Only2U', 'Application name'),
('app_version', '1.0.0', 'Current application version'),
('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
('razorpay_webhook_secret', '', 'Razorpay webhook secret for payment verification')
ON CONFLICT (key) DO NOTHING;

-- Create RLS policies for settings table
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to settings (for app configuration)
CREATE POLICY "Allow public read access to settings" ON settings
  FOR SELECT USING (is_active = true);

-- Allow admin users to manage settings
CREATE POLICY "Allow admin users to manage settings" ON settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_active ON settings(is_active);
