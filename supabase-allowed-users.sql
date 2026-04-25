-- CalorieFlow – Allowed Users Migration (2026-04-25)
--
-- Adds the dynamic per-email allowlist that the Admin UI manages.
-- Run this once in Supabase Dashboard → SQL Editor.
--
-- After running, any email already listed in the ALLOWED_EMAILS
-- env var still works (those are implicit "super admins"), and the
-- Admin page lets you add / remove / promote additional users.

-- 1. Table
CREATE TABLE IF NOT EXISTS public.allowed_users (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  added_by    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Case-insensitive lookups (email comparisons should be lowercased anyway,
--    but this index also catches any rows inserted with mixed casing).
CREATE UNIQUE INDEX IF NOT EXISTS allowed_users_email_lower_idx
  ON public.allowed_users (LOWER(email));

-- 3. RLS – authenticated users can only read THEIR OWN row
--    (used by middleware to verify access). All admin write operations go
--    through server routes that use the SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_allowed_row" ON public.allowed_users;
CREATE POLICY "select_own_allowed_row" ON public.allowed_users
  FOR SELECT USING (
    LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- 4. updated_at trigger (reuses update_updated_at() created in supabase-schema.sql)
DROP TRIGGER IF EXISTS allowed_users_updated_at ON public.allowed_users;
CREATE TRIGGER allowed_users_updated_at
  BEFORE UPDATE ON public.allowed_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
