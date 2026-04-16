-- CalorieFlow v2 – New tables for calorie goals & activity
-- Run this in the Supabase Dashboard → SQL Editor

-- 1. User settings (daily calorie goal)
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  daily_goal_calories  INTEGER NOT NULL DEFAULT 2000,
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own_settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Daily activity (calories burned per day)
CREATE TABLE IF NOT EXISTS public.daily_activity (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date             DATE NOT NULL,
  calories_burned  INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS daily_activity_user_date_idx ON public.daily_activity (user_id, date);

ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage_own_activity" ON public.daily_activity
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER daily_activity_updated_at
  BEFORE UPDATE ON public.daily_activity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
