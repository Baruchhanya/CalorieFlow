-- CalorieFlow v12 — Oura Ring integration (OAuth2 tokens + daily_activity source tracking)
-- Run in Supabase Dashboard → SQL Editor. Idempotent / safe to re-run.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS oura_access_token     TEXT,
  ADD COLUMN IF NOT EXISTS oura_refresh_token    TEXT,
  ADD COLUMN IF NOT EXISTS oura_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS oura_last_sync        TIMESTAMPTZ;

COMMENT ON COLUMN public.user_settings.oura_access_token IS
  'Oura OAuth2 access token. Short-lived — refresh before use once oura_token_expires_at is near.';
COMMENT ON COLUMN public.user_settings.oura_refresh_token IS
  'Oura OAuth2 refresh token. Single-use — replaced on every refresh, must always store the latest.';
COMMENT ON COLUMN public.user_settings.oura_token_expires_at IS
  'Expiry timestamp of oura_access_token.';
COMMENT ON COLUMN public.user_settings.oura_last_sync IS
  'Timestamp of the last successful calories-burned sync from Oura.';

ALTER TABLE public.daily_activity
  ADD COLUMN IF NOT EXISTS source TEXT;

COMMENT ON COLUMN public.daily_activity.source IS
  'Origin of calories_burned: manual (user entered) or oura (Oura Ring sync).';

-- Backfill existing rows as manual entries.
UPDATE public.daily_activity SET source = 'manual' WHERE source IS NULL;
