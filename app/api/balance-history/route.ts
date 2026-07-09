import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { buildGoalResolver, DEFAULT_DAILY_GOAL } from "@/lib/goal";
import { computeBalanceHistory } from "@/lib/balance";

export type { BalanceDay, BalanceHistoryResponse } from "@/lib/balance";

export async function GET() {
  const t0 = performance.now();
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const from30 = new Date(today);
  from30.setDate(from30.getDate() - 29);
  const fromStr = from30.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  const [mealsRes, activityRes, settingsRes, acksRes] = await Promise.all([
    supabase
      .from("meals")
      .select("date, calories")
      .eq("user_id", user.id)
      .gte("date", fromStr)
      .lte("date", todayStr),
    supabase
      .from("daily_activity")
      .select("date, calories_burned")
      .eq("user_id", user.id)
      .gte("date", fromStr)
      .lte("date", todayStr),
    supabase
      .from("user_settings")
      .select("daily_goal_calories")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("day_acknowledgments")
      .select("date, estimated_balance")
      .eq("user_id", user.id)
      .gte("date", fromStr)
      .lte("date", todayStr),
  ]);

  const currentGoal = settingsRes.data?.daily_goal_calories ?? DEFAULT_DAILY_GOAL;
  const goalForDate = await buildGoalResolver(supabase, user.id, currentGoal);

  const balanceHistory = computeBalanceHistory({
    meals: mealsRes.data ?? [],
    activity: activityRes.data ?? [],
    acks: acksRes.data ?? [],
    goalForDate,
    from: from30,
    today,
  });

  console.log(`[perf] /api/balance-history: ${Math.round(performance.now() - t0)}ms`);

  return NextResponse.json(balanceHistory);
}
