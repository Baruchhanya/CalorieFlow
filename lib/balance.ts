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

interface MealRow { date: string; calories: number | null }
interface ActivityRow { date: string; calories_burned: number | null }
interface AckRow { date: string; estimated_balance: number }

export interface ComputeBalanceArgs {
  meals: MealRow[];
  activity: ActivityRow[];
  acks: AckRow[];
  goalForDate: (date: string) => number;
  /** Start of the 30-day window (inclusive). */
  from: Date;
  /** "Now" — used to exclude today and anchor the 7-day chart window. */
  today: Date;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Computes the balance-history payload (per-day deficit/surplus, weekly/monthly
 * aggregates, and the 7-day chart series) shared by /api/balance-history and
 * /api/init. Operates in UTC, matching the server's date semantics.
 */
export function computeBalanceHistory({
  meals,
  activity,
  acks,
  goalForDate,
  from,
  today,
}: ComputeBalanceArgs): BalanceHistoryResponse {
  const todayStr = isoDate(today);

  const calorieMap = new Map<string, number>();
  for (const m of meals) {
    calorieMap.set(m.date, (calorieMap.get(m.date) ?? 0) + (m.calories ?? 0));
  }
  const activityMap = new Map<string, number>();
  for (const a of activity) {
    activityMap.set(a.date, a.calories_burned ?? 0);
  }
  const ackMap = new Map<string, number>();
  for (const a of acks) {
    ackMap.set(a.date, a.estimated_balance);
  }

  // Per-day entries — only days with real meal data, EXCLUDING today.
  const allDays: BalanceDay[] = [];
  const cur = new Date(from);
  while (cur < today) {
    const dateStr = isoDate(cur);
    if (dateStr !== todayStr) {
      const consumed = calorieMap.get(dateStr);
      if (consumed !== undefined) {
        const burned = activityMap.get(dateStr) ?? 0;
        allDays.push({ date: dateStr, balance: Math.round((consumed - burned) - goalForDate(dateStr)) });
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  const days7 = allDays.slice(-7);
  const weeklySum = days7.reduce((s, d) => s + d.balance, 0);
  const monthlySum = allDays.reduce((s, d) => s + d.balance, 0);

  // chart_days: last 7 calendar days (not today) with any data (tracked or acknowledged).
  const chart_days: BalanceDay[] = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = isoDate(d);
    const consumed = calorieMap.get(dateStr);
    if (consumed !== undefined) {
      const burned = activityMap.get(dateStr) ?? 0;
      chart_days.push({ date: dateStr, balance: Math.round((consumed - burned) - goalForDate(dateStr)) });
    } else if (ackMap.has(dateStr)) {
      chart_days.push({ date: dateStr, balance: ackMap.get(dateStr)!, estimated: true });
    }
  }

  return {
    days7,
    chart_days,
    weekly_avg: days7.length > 0 ? Math.round(weeklySum / days7.length) : null,
    weekly_total: days7.length > 0 ? Math.round(weeklySum) : null,
    monthly_avg: allDays.length > 0 ? Math.round(monthlySum / allDays.length) : null,
    monthly_total: allDays.length > 0 ? Math.round(monthlySum) : null,
  };
}
