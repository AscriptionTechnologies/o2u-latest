-- Clear Supabase cache and fix column name issue
-- This script will refresh the schema cache and ensure proper column naming

-- First, let's check what columns actually exist in the users table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- If profile_photo exists and profilePhoto doesn't, rename it
DO $$
BEGIN
  -- Check if profile_photo exists and profilePhoto doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'profile_photo'
    AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'profilePhoto'
    AND table_schema = 'public'
  ) THEN
    -- Rename the column
    ALTER TABLE users RENAME COLUMN profile_photo TO "profilePhoto";
    RAISE NOTICE 'Renamed profile_photo to profilePhoto';
  END IF;
END $$;

-- Add the profilePhoto column if it doesn't exist at all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'profilePhoto'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE users ADD COLUMN "profilePhoto" TEXT;
    RAISE NOTICE 'Added profilePhoto column';
  END IF;
END $$;

-- Force refresh the PostgREST schema cache
-- This is done by sending a NOTIFY signal that PostgREST listens to
NOTIFY pgrst, 'reload schema';

-- Verify the column exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'profilePhoto'
      AND table_schema = 'public'
    ) 
    THEN 'SUCCESS: profilePhoto column exists!'
    ELSE 'ERROR: profilePhoto column not found!'
  END as status;

-- Show all user table columns for verification
SELECT 'Current users table columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
ORDER BY ordinal_position;
