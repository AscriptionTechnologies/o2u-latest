-- Remove role check constraint(s) on users table
-- This drops commonly named constraints and any check constraint that references the role column

-- Drop by common explicit names first (safe if not present)
ALTER TABLE users DROP CONSTRAINT IF EXISTS user_role_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Fallback: drop any CHECK constraint on users whose definition mentions the role column
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'users'
      AND n.nspname = 'public'
      AND c.contype = 'c'  -- check constraints
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

-- Optional: verify no role check constraints remain
-- SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
-- FROM pg_constraint c
-- JOIN pg_class t ON t.oid = c.conrelid
-- JOIN pg_namespace n ON n.oid = t.relnamespace
-- WHERE t.relname = 'users' AND n.nspname = 'public' AND c.contype = 'c';


