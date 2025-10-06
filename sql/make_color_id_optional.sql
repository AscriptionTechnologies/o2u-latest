-- Make color_id optional in product_variants table
-- This script removes the NOT NULL constraint and foreign key relation for color_id

-- First, drop the foreign key constraint if it exists
DO $$ 
BEGIN
    -- Check if the foreign key constraint exists and drop it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'product_variants_color_id_fkey' 
        AND table_name = 'product_variants'
    ) THEN
        ALTER TABLE product_variants DROP CONSTRAINT product_variants_color_id_fkey;
    END IF;
END $$;

-- Make color_id nullable
ALTER TABLE product_variants ALTER COLUMN color_id DROP NOT NULL;

-- Add a comment to document the change
COMMENT ON COLUMN product_variants.color_id IS 'Optional color reference. NULL means no specific color is assigned to this variant.';

-- Update any existing variants that might have invalid color_id references
-- Set color_id to NULL for variants where the referenced color doesn't exist
UPDATE product_variants 
SET color_id = NULL 
WHERE color_id IS NOT NULL 
AND NOT EXISTS (
    SELECT 1 FROM colors WHERE colors.id = product_variants.color_id
);

-- Optional: Add a check constraint to ensure color_id is either NULL or references a valid color
-- ALTER TABLE product_variants 
-- ADD CONSTRAINT product_variants_color_id_check 
-- CHECK (color_id IS NULL OR EXISTS (SELECT 1 FROM colors WHERE colors.id = color_id)); 