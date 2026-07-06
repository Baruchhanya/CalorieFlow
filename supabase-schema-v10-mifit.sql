-- CalorieFlow v10 – Mi Fitness / Zepp Life integration tokens
-- Run in Supabase Dashboard → SQL Editor. Idempotent / safe to re-run.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS mifit_app_token  TEXT,
  ADD COLUMN IF NOT EXISTS mifit_user_id    TEXT,
  ADD COLUMN IF NOT EXISTS mifit_last_sync  TIMESTAMPTZ;

COMMENT ON COLUMN public.user_settings.mifit_app_token IS
  'Encrypted Mi Fitness / Zepp Life API token. Only returned server-side.';
COMMENT ON COLUMN public.user_settings.mifit_user_id IS
  'Huami / Mi Fitness user ID corresponding to the stored app token.';
COMMENT ON COLUMN public.user_settings.mifit_last_sync IS
  'Timestamp of the last successful weight sync from Mi Fitness.';
