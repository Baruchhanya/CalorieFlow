import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface BalanceDay {
  date: string;
  balance: number; // (consumed - burned) - goal; negative = deficit, positive = surplus
  estimated?: boolean; // true when balance comes from user acknowledgment, not actual meal data
}

export interface BalanceHistoryResponse {
  days7: BalanceDay[];        // last ≤7 tracked days (for stat tiles — only real meal data)
  chart_days: BalanceDay[];   // last 7 calendar days with any data (tracked + acknowledged)
  weekly_avg: number | null;  // mean balance over days7
  weekly_total: number | null; // sum balance over days7
  monthly_avg: number | null; // mean balance over all tracked days in last 30 days
  monthly_total: number | null; // sum balance over all tracked days in last 30 days
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  const goal = settingsRes.data?.daily_goal_calories ?? 1820;

  const calorieMap = new Map<string, number>();
  for (const m of mealsRes.data ?? []) {
    calorieMap.set(m.date, (calorieMap.get(m.date) ?? 0) + (m.calories ?? 0));
  }

  const activityMap = new Map<string, number>();
  for (const a of activityRes.data ?? []) {
    activityMap.set(a.date, a.calories_burned ?? 0);
  }

  const ackMap = new Map<string, number>();
  for (const a of acksRes.data ?? []) {
    ackMap.set(a.date, a.estimated_balance);
  }

  // Build per-day entries — only days with real meal data, EXCLUDING today
  const allDays: BalanceDay[] = [];
  const cur = new Date(from30);
  while (cur < today) {
    const dateStr = cur.toISOString().split("T")[0];
    if (dateStr !== todayStr) {
      const consumed = calorieMap.get(dateStr);
      if (consumed !== undefined) {
        const burned = activityMap.get(dateStr) ?? 0;
        allDays.push({ date: dateStr, balance: Math.round((consumed - burned) - goal) });
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  const days7 = allDays.slice(-7);

  const weeklySum = days7.reduce((s, d) => s + d.balance, 0);
  const monthlySum = allDays.reduce((s, d) => s + d.balance, 0);

  const weekly_avg = days7.length > 0 ? Math.round(weeklySum / days7.length) : null;
  const weekly_total = days7.length > 0 ? Math.round(weeklySum) : null;
  const monthly_avg = allDays.length > 0 ? Math.round(monthlySum / allDays.length) : null;
  const monthly_total = allDays.length > 0 ? Math.round(monthlySum) : null;

  // Build chart_days: last 7 calendar days (not today) with any data (tracked or acknowledged)
  const chart_days: BalanceDay[] = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    const consumed = calorieMap.get(dateStr);
    if (consumed !== undefined) {
      const burned = activityMap.get(dateStr) ?? 0;
      chart_days.push({ date: dateStr, balance: Math.round((consumed - burned) - goal) });
    } else if (ackMap.has(dateStr)) {
      chart_days.push({ date: dateStr, balance: ackMap.get(dateStr)!, estimated: true });
    }
  }

  return NextResponse.json({ days7, chart_days, weekly_avg, weekly_total, monthly_avg, monthly_total } satisfies BalanceHistoryResponse);
}
