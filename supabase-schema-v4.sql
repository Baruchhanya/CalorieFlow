-- CalorieFlow v4 – Weight log
-- Run this in: Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.weight_log (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date       DATE NOT NULL,
  weight_kg  NUMERIC(5,1) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, date)
);

ALTER TABLE public.weight_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own weight"
  ON public.weight_log FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
