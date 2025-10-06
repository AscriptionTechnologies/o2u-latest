-- User addresses table for multi-address support
CREATE TABLE IF NOT EXISTS user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(80), -- e.g., Home, Work
  full_name VARCHAR(120),
  phone VARCHAR(20),
  street_line1 TEXT NOT NULL,
  street_line2 TEXT,
  landmark TEXT,
  city VARCHAR(120) NOT NULL,
  state VARCHAR(120) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(120) DEFAULT 'India',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Simple index
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);


