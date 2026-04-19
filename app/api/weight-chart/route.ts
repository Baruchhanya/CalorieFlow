import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface ChartDay {
  date: string;
  label: string;         // DD/MM for display
  weight_kg: number | null;
  balance: number | null; // (consumed - burned) - goal → negative=deficit, positive=surplus
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Date range: last 60 days
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 59);
  const fromStr = from.toISOString().split("T")[0];
  const toStr = to.toISOString().split("T")[0];

  // Fetch all data in parallel
  const [weightRes, mealsRes, activityRes, settingsRes] = await Promise.all([
    supabase.from("weight_log").select("date, weight_kg").eq("user_id", user.id)
      .gte("date", fromStr).lte("date", toStr).order("date"),
    supabase.from("meals").select("date, calories").eq("user_id", user.id)
      .gte("date", fromStr).lte("date", toStr),
    supabase.from("daily_activity").select("date, calories_burned").eq("user_id", user.id)
      .gte("date", fromStr).lte("date", toStr),
    supabase.from("user_settings").select("daily_goal_calories").eq("user_id", user.id).single(),
  ]);

  const goal = settingsRes.data?.daily_goal_calories ?? 1820;

  // Build weight map
  const weightMap = new Map<string, number>();
  for (const w of weightRes.data ?? []) weightMap.set(w.date, Number(w.weight_kg));

  // Build calorie map (sum per day)
  const calorieMap = new Map<string, number>();
  for (const m of mealsRes.data ?? []) {
    calorieMap.set(m.date, (calorieMap.get(m.date) ?? 0) + (m.calories ?? 0));
  }

  // Build activity map
  const activityMap = new Map<string, number>();
  for (const a of activityRes.data ?? []) activityMap.set(a.date, a.calories_burned ?? 0);

  // Build day-by-day array — only include days that have weight OR calorie data
  const days: ChartDay[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    const dateStr = cur.toISOString().split("T")[0];
    const [y, m, d] = dateStr.split("-");
    const label = `${d}/${m}`;
    const weight_kg = weightMap.has(dateStr) ? weightMap.get(dateStr)! : null;
    const consumed = calorieMap.get(dateStr) ?? null;
    const burned = activityMap.get(dateStr) ?? 0;
    const balance = consumed !== null ? (consumed - burned) - goal : null;

    if (weight_kg !== null || consumed !== null) {
      days.push({ date: dateStr, label, weight_kg, balance });
    }

    cur.setDate(cur.getDate() + 1);
  }

  return NextResponse.json({ days, goal });
}
