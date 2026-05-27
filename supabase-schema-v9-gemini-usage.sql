-- CalorieFlow v9 – Gemini API usage log
-- Tracks every call to /api/analyze (text/image/audio) so the admin page can
-- show per-user statistics: # of calls, tokens consumed, estimated cost.
-- Run in Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS public.gemini_usage (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email         TEXT,
  request_type       TEXT NOT NULL,
  model              TEXT,
  image_count        INTEGER NOT NULL DEFAULT 0,
  prompt_tokens      INTEGER,
  candidates_tokens  INTEGER,
  total_tokens       INTEGER,
  duration_ms        INTEGER,
  status             TEXT NOT NULL DEFAULT 'success',
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gemini_usage_user_date_idx
  ON public.gemini_usage (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gemini_usage_date_idx
  ON public.gemini_usage (created_at DESC);

-- All reads/writes happen through the service_role key in server routes.
-- RLS is enabled with NO policies, which means authenticated/anon roles have no access.
ALTER TABLE public.gemini_usage ENABLE ROW LEVEL SECURITY;

-- Explicit grants (Supabase Oct 2026): no grants to authenticated/anon.
-- service_role bypasses RLS, so no grant required for server-side writes.
