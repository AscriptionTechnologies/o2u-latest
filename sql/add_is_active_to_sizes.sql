-- Add is_active column to sizes table if it doesn't exist

DO $$ 
BEGIN
  -- Check and add is_active column to sizes table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sizes' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE sizes ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    COMMENT ON COLUMN sizes.is_active IS 'Whether this size is currently active and should be displayed';
  END IF;
END $$;

-- Update all existing sizes to be active
UPDATE sizes SET is_active = TRUE WHERE is_active IS NULL;

-- Ensure default sizes exist
INSERT INTO sizes (id, name, is_active) 
SELECT * FROM (VALUES 
  ('550e8400-e29b-41d4-a716-446655441001', 'XS', TRUE),
  ('550e8400-e29b-41d4-a716-446655441002', 'S', TRUE),
  ('550e8400-e29b-41d4-a716-446655441003', 'M', TRUE),
  ('550e8400-e29b-41d4-a716-446655441004', 'L', TRUE),
  ('550e8400-e29b-41d4-a716-446655441005', 'XL', TRUE),
  ('550e8400-e29b-41d4-a716-446655441006', 'XXL', TRUE),
  ('550e8400-e29b-41d4-a716-446655441007', 'Free Size', TRUE)
) AS v(id, name, is_active)
ON CONFLICT (id) DO UPDATE SET is_active = TRUE;

SELECT 'Sizes table updated successfully with is_active column' AS status;

