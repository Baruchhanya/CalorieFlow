-- CalorieFlow – Supabase Schema
-- Run this in the Supabase Dashboard → SQL Editor

-- 1. Create the meals table
CREATE TABLE IF NOT EXISTS public.meals (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date        TEXT NOT NULL,          -- YYYY-MM-DD
  name        TEXT NOT NULL,
  quantity    TEXT,
  calories    FLOAT NOT NULL DEFAULT 0,
  protein     FLOAT NOT NULL DEFAULT 0,
  carbs       FLOAT NOT NULL DEFAULT 0,
  fat         FLOAT NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index for fast date lookups
CREATE INDEX IF NOT EXISTS meals_user_date_idx ON public.meals (user_id, date);

-- 3. Enable Row Level Security
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies – users can only access their own rows
CREATE POLICY "select_own_meals" ON public.meals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own_meals" ON public.meals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_meals" ON public.meals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete_own_meals" ON public.meals
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meals_updated_at
  BEFORE UPDATE ON public.meals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
