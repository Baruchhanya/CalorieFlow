import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGoalFromHistory, DEFAULT_DAILY_GOAL } from "@/lib/goal";
import type { MealEntry, UserProfile } from "@/types";

export interface CriticalInitData {
  user: { email: string | null };
  entries: MealEntry[];
  daily_goal_calories: number;
  current_daily_goal_calories: number;
  profile: UserProfile | null;
  calories_burned: number;
}

export async function readProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  const tryFull = await supabase
    .from("user_profile")
    .select("height_cm, weight_kg, age, protein_goal_g")
    .eq("user_id", userId)
    .single();
  if (!tryFull.error) return tryFull.data;

  const msg = (tryFull.error.message || "").toLowerCase();
  if (msg.includes("protein_goal_g") || msg.includes("does not exist") || msg.includes("column")) {
    const legacy = await supabase
      .from("user_profile")
      .select("height_cm, weight_kg, age")
      .eq("user_id", userId)
      .single();
    if (!legacy.error && legacy.data) return { ...legacy.data, protein_goal_g: null };
  }
  return null;
}

/**
 * The minimal payload needed to make the main UI usable for a given date.
 * Shared by the /api/init critical phase and the server-rendered home page,
 * so first paint can carry real data without a client fetch waterfall.
 */
export async function fetchCriticalInitData(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  date: string
): Promise<CriticalInitData> {
  const [entriesRes, settingsRes, profile, activityRes, goalHistoryRes] = await Promise.all([
    supabase
      .from("meals")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .order("created_at", { ascending: true }),
    supabase
      .from("user_settings")
      .select("daily_goal_calories")
      .eq("user_id", user.id)
      .single(),
    readProfile(supabase, user.id),
    supabase
      .from("daily_activity")
      .select("calories_burned")
      .eq("user_id", user.id)
      .eq("date", date)
      .single(),
    supabase
      .from("goal_history")
      .select("effective_date, daily_goal_calories")
      .eq("user_id", user.id)
      .order("effective_date", { ascending: true }),
  ]);

  const currentGoal = settingsRes.data?.daily_goal_calories ?? DEFAULT_DAILY_GOAL;
  const goalForDate = resolveGoalFromHistory(goalHistoryRes.data ?? [], currentGoal);

  return {
    user: { email: user.email ?? null },
    entries: (entriesRes.data ?? []) as MealEntry[],
    daily_goal_calories: goalForDate(date),
    current_daily_goal_calories: currentGoal,
    profile,
    calories_burned: activityRes.data?.calories_burned ?? 0,
  };
}
