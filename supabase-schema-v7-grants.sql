-- CalorieFlow v7 – Explicit Data API grants
-- Run this in: Supabase Dashboard → SQL Editor
--
-- From October 30 2026, Supabase will stop exposing public schema tables
-- to the Data API by default. This migration adds explicit GRANT statements
-- to all existing tables so the app keeps working after that date.
-- Safe to run multiple times (GRANT is idempotent).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meals          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_activity TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profile   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_log     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_presets   TO authenticated;

-- allowed_users: authenticated users may only read their own row (RLS enforces this).
-- All writes go through service_role in server routes.
GRANT SELECT ON public.allowed_users TO authenticated;
