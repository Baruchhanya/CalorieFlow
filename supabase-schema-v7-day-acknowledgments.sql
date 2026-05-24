-- CalorieFlow v7 – Day acknowledgments for untracked days
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.day_acknowledgments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date            DATE NOT NULL,
  estimated_balance INTEGER NOT NULL,  -- negative = deficit, 0 = balance, positive = surplus
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS day_acks_user_date_idx ON public.day_acknowledgments (user_id, date);

ALTER TABLE public.day_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "day_acks_select_own"
  ON public.day_acknowledgments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "day_acks_insert_own"
  ON public.day_acknowledgments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "day_acks_update_own"
  ON public.day_acknowledgments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "day_acks_delete_own"
  ON public.day_acknowledgments FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER day_acks_updated_at
  BEFORE UPDATE ON public.day_acknowledgments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_acknowledgments TO authenticated;
