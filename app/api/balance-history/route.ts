import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface BalanceDay {
  date: string;
  balance: number; // (consumed - burned) - goal; negative = deficit, positive = surplus
}

export interface BalanceHistoryResponse {
  days7: BalanceDay[];        // last ≤7 tracked days (for chart)
  weekly_avg: number | null;  // mean balance over days7
  monthly_avg: number | null; // mean balance over all tracked days in last 30 days
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const from30 = new Date(today);
  from30.setDate(from30.getDate() - 29);
  const fromStr = from30.toISOString().split("T")[0];
  const toStr = today.toISOString().split("T")[0];

  const [mealsRes, activityRes, settingsRes] = await Promise.all([
    supabase
      .from("meals")
      .select("date, calories")
      .eq("user_id", user.id)
      .gte("date", fromStr)
      .lte("date", toStr),
    supabase
      .from("daily_activity")
      .select("date, calories_burned")
      .eq("user_id", user.id)
      .gte("date", fromStr)
      .lte("date", toStr),
    supabase
      .from("user_settings")
      .select("daily_goal_calories")
      .eq("user_id", user.id)
      .single(),
  ]);

  const goal = settingsRes.data?.daily_goal_calories ?? 1820;

  const calorieMap = new Map<string, number>();
  for (const m of mealsRes.data ?? []) {
    calorieMap.set(m.date, (calorieMap.get(m.date) ?? 0) + (m.calories ?? 0));
  }

  const activityMap = new Map<string, number>();
  for (const a of activityRes.data ?? []) {
    activityMap.set(a.date, a.calories_burned ?? 0);
  }

  // Build per-day entries — only days that have meal data
  const allDays: BalanceDay[] = [];
  const cur = new Date(from30);
  while (cur <= today) {
    const dateStr = cur.toISOString().split("T")[0];
    const consumed = calorieMap.get(dateStr);
    if (consumed !== undefined) {
      const burned = activityMap.get(dateStr) ?? 0;
      allDays.push({ date: dateStr, balance: Math.round((consumed - burned) - goal) });
    }
    cur.setDate(cur.getDate() + 1);
  }

  const days7 = allDays.slice(-7);

  const weekly_avg =
    days7.length > 0
      ? Math.round(days7.reduce((s, d) => s + d.balance, 0) / days7.length)
      : null;

  const monthly_avg =
    allDays.length > 0
      ? Math.round(allDays.reduce((s, d) => s + d.balance, 0) / allDays.length)
      : null;

  return NextResponse.json({ days7, weekly_avg, monthly_avg } satisfies BalanceHistoryResponse);
}
