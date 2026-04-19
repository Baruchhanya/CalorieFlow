import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [mealsRes, activityRes, settingsRes] = await Promise.all([
    supabase.from("meals").select("date, calories, protein, carbs, fat").eq("user_id", user.id).order("date", { ascending: false }),
    supabase.from("daily_activity").select("date, calories_burned").eq("user_id", user.id),
    supabase.from("user_settings").select("daily_goal_calories").eq("user_id", user.id).single(),
  ]);

  const goalCalories = settingsRes.data?.daily_goal_calories ?? 1820;

  // Build activity map
  const activityMap = new Map<string, number>();
  for (const a of activityRes.data ?? []) {
    activityMap.set(a.date, a.calories_burned ?? 0);
  }

  // Aggregate meals by date
  const map = new Map<string, {
    date: string; count: number; calories: number;
    protein: number; carbs: number; fat: number;
  }>();

  for (const row of mealsRes.data ?? []) {
    const entry = map.get(row.date) ?? { date: row.date, count: 0, calories: 0, protein: 0, carbs: 0, fat: 0 };
    entry.count += 1;
    entry.calories += row.calories;
    entry.protein += row.protein;
    entry.carbs += row.carbs;
    entry.fat += row.fat;
    map.set(row.date, entry);
  }

  const result = Array.from(map.values()).map((g) => ({
    ...g,
    calories: Math.round(g.calories),
    protein: Math.round(g.protein),
    carbs: Math.round(g.carbs),
    fat: Math.round(g.fat),
    calories_burned: activityMap.get(g.date) ?? 0,
    goal_calories: goalCalories,
  }));

  return NextResponse.json(result);
}
