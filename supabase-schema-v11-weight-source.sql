-- CalorieFlow v11 — weight_log source tracking (manual vs Mi Fitness sync)
-- Run in Supabase Dashboard → SQL Editor. Idempotent / safe to re-run.

ALTER TABLE public.weight_log
  ADD COLUMN IF NOT EXISTS source TEXT;

COMMENT ON COLUMN public.weight_log.source IS
  'Origin of the weigh-in: manual (user entered) or mifit (Mi Fitness / Zepp sync).';

-- Backfill existing rows as manual entries.
UPDATE public.weight_log SET source = 'manual' WHERE source IS NULL;
