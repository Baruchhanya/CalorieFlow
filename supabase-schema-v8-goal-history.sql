-- CalorieFlow v8 – Goal history: daily_goal_calories changes take effect from a date forward
-- Past dates use the goal that was active at that date.
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.goal_history (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  effective_date       DATE NOT NULL,
  daily_goal_calories  INTEGER NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, effective_date)
);

CREATE INDEX IF NOT EXISTS goal_history_user_date_idx
  ON public.goal_history (user_id, effective_date DESC);

ALTER TABLE public.goal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_history_select_own"
  ON public.goal_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "goal_history_insert_own"
  ON public.goal_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goal_history_update_own"
  ON public.goal_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "goal_history_delete_own"
  ON public.goal_history FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_history TO authenticated;
