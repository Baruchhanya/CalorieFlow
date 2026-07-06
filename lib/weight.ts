import { offsetDate, toLocalIso } from "@/lib/dates";

export type WeightSource = "manual" | "mifit";

export interface WeightEntry {
  id: string;
  date: string;
  weight_kg: number;
  source?: WeightSource | null;
}

export const WEIGHT_SOURCE_LABELS: Record<WeightSource, { he: string; en: string }> = {
  manual: { he: "ידני",      en: "Manual" },
  mifit:  { he: "Mi Fitness", en: "Mi Fitness" },
};

export interface WeightWeek {
  weekStart: string;
  weekEnd: string;
  label: string;
  avg_kg: number;
  count: number;
}

/** Sunday of the calendar week containing `dateStr`, as YYYY-MM-DD. */
export function weekStartIso(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - d.getDay());
  return toLocalIso(d);
}

function rangeLabel(weekStart: string, weekEnd: string): string {
  const [, mS, dS] = weekStart.split("-");
  const [, mE, dE] = weekEnd.split("-");
  return `${dS}/${mS}–${dE}/${mE}`;
}

export function computeWeeklyAverages(entries: WeightEntry[]): WeightWeek[] {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const e of entries) {
    const key = weekStartIso(e.date);
    const cur = buckets.get(key) ?? { sum: 0, count: 0 };
    cur.sum += Number(e.weight_kg);
    cur.count += 1;
    buckets.set(key, cur);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, { sum, count }]) => {
      const weekEnd = offsetDate(weekStart, 6);
      return {
        weekStart,
        weekEnd,
        label: rangeLabel(weekStart, weekEnd),
        avg_kg: sum / count,
        count,
      };
    });
}

export interface WeekSummary {
  thisWeek: WeightWeek | null;
  prevWeek: WeightWeek | null;
  delta: number | null;
  currentWeekStart: string;
  currentWeekEnd: string;
  currentRangeLabel: string;
}

/**
 * Build the current-week summary: this-week bucket (or null if none yet),
 * previous week's bucket, and the delta between them.
 */
export function getWeekSummary(entries: WeightEntry[], today: string): WeekSummary {
  const weeks = computeWeeklyAverages(entries);
  const currentWeekStart = weekStartIso(today);
  const currentWeekEnd = offsetDate(currentWeekStart, 6);
  const thisWeek = weeks.find((w) => w.weekStart === currentWeekStart) ?? null;
  const prevWeek = [...weeks].reverse().find((w) => w.weekStart < currentWeekStart) ?? null;
  const delta = thisWeek && prevWeek ? thisWeek.avg_kg - prevWeek.avg_kg : null;
  return {
    thisWeek,
    prevWeek,
    delta,
    currentWeekStart,
    currentWeekEnd,
    currentRangeLabel: rangeLabel(currentWeekStart, currentWeekEnd),
  };
}
