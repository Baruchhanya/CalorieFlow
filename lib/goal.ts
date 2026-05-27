import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_DAILY_GOAL = 1820;

export interface GoalHistoryRow {
  effective_date: string;
  daily_goal_calories: number;
}

/**
 * Builds a resolver that, given a YYYY-MM-DD date string, returns the daily
 * goal effective on that date. Loads goal_history once per call site.
 *
 * Resolution: pick the row with the greatest effective_date <= the given date.
 * If no row applies (history is empty or all rows are in the future), fall
 * back to user_settings.daily_goal_calories (the current goal).
 */
export async function buildGoalResolver(
  supabase: SupabaseClient,
  userId: string,
  currentGoal: number,
): Promise<(date: string) => number> {
  const { data } = await supabase
    .from("goal_history")
    .select("effective_date, daily_goal_calories")
    .eq("user_id", userId)
    .order("effective_date", { ascending: true });

  const history: GoalHistoryRow[] = data ?? [];

  return (date: string): number => {
    if (history.length === 0) return currentGoal;
    let resolved: number | null = null;
    for (const row of history) {
      if (row.effective_date <= date) resolved = row.daily_goal_calories;
      else break;
    }
    return resolved ?? currentGoal;
  };
}
