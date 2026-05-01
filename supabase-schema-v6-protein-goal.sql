-- CalorieFlow v6 — User-configurable daily protein goal (grams)
-- Run this in: Supabase Dashboard → SQL Editor.
-- Idempotent / safe to re-run.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS protein_goal_g INTEGER;

COMMENT ON COLUMN public.user_profile.protein_goal_g IS
  'User-defined daily protein target in grams. NULL = use auto-calculated value (weight_kg * factor).';

-- Optional sanity check constraint (10g – 500g/day covers any realistic case)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profile_protein_goal_g_range'
  ) THEN
    ALTER TABLE public.user_profile
      ADD CONSTRAINT user_profile_protein_goal_g_range
      CHECK (protein_goal_g IS NULL OR (protein_goal_g >= 10 AND protein_goal_g <= 500));
  END IF;
END $$;
