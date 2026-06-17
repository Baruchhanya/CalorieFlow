import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_DAILY_GOAL = 1820;

export interface GoalHistoryRow {
  effective_date: string;
  daily_goal_calories: number;
}

/**
 * Pure resolver: given pre-fetched goal_history rows (ascending by
 * effective_date) and the current goal, returns a function mapping a
 * YYYY-MM-DD date to the goal effective on that date.
 *
 * Resolution: pick the row with the greatest effective_date <= the given date.
 * If no row applies (history is empty or all rows are in the future), fall
 * back to the current goal.
 *
 * Use this when the goal_history rows have already been fetched (e.g. folded
 * into a parallel Promise.all) so the query doesn't sit serially on the path.
 */
export function resolveGoalFromHistory(
  history: GoalHistoryRow[],
  currentGoal: number,
): (date: string) => number {
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

/**
 * Fetches goal_history once, then builds the resolver via
 * {@link resolveGoalFromHistory}. Prefer fetching goal_history inside an
 * existing Promise.all and calling resolveGoalFromHistory directly when you
 * want the query to overlap with other work.
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

  return resolveGoalFromHistory(data ?? [], currentGoal);
}
