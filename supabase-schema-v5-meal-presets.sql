-- CalorieFlow v5 – Saved recurring meals (quick-add presets)
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.meal_presets (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  quantity    TEXT,
  calories    DOUBLE PRECISION NOT NULL DEFAULT 0,
  protein     DOUBLE PRECISION NOT NULL DEFAULT 0,
  carbs       DOUBLE PRECISION NOT NULL DEFAULT 0,
  fat         DOUBLE PRECISION NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS meal_presets_user_idx ON public.meal_presets (user_id, sort_order, created_at);

ALTER TABLE public.meal_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_presets_select_own"
  ON public.meal_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "meal_presets_insert_own"
  ON public.meal_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meal_presets_update_own"
  ON public.meal_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "meal_presets_delete_own"
  ON public.meal_presets FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER meal_presets_updated_at
  BEFORE UPDATE ON public.meal_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
