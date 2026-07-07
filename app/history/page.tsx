"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, Flame, TrendingUp, TrendingDown, UtensilsCrossed, Scale } from "lucide-react";
import { useLang } from "@/lib/i18n/context";

interface DaySummary {
  date: string;
  count: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  calories_burned?: number;
  goal_calories?: number;
}

function formatDate(dateStr: string, lang: string) {
  const locale = lang === "he" ? "he-IL" : "en-US";
  const date = new Date(dateStr + "T12:00:00");
  return {
    day: date.toLocaleDateString(locale, { day: "numeric" }),
    weekday: date.toLocaleDateString(locale, { weekday: "short" }),
    monthYear: date.toLocaleDateString(locale, { month: "long", year: "numeric" }),
  };
}

function groupByMonth(days: DaySummary[], lang: string) {
  const map = new Map<string, DaySummary[]>();
  for (const d of days) {
    const label = formatDate(d.date, lang).monthYear;
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(d);
  }
  return Array.from(map.entries()).map(([label, days]) => ({ label, days }));
}

export default function HistoryPage() {
  const router = useRouter();
  const { T, lang } = useLang();
  const [history, setHistory] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultGoal, setDefaultGoal] = useState(1820);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => {
        setHistory(Array.isArray(d?.days) ? d.days : []);
        if (typeof d?.daily_goal_calories === "number") setDefaultGoal(d.daily_goal_calories);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalDays = history.length;
  const avgCalories = totalDays > 0
    ? Math.round(history.reduce((s, d) => s + d.calories, 0) / totalDays) : 0;
  const totalMeals = history.reduce((s, d) => s + d.count, 0);
  const deficitDays = history.filter(d => d.calories < (d.goal_calories ?? defaultGoal)).length;
  const grouped = groupByMonth(history, lang);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface border-b border-line">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push("/")}
            className="p-2 rounded-xl bg-canvas hover:bg-line/60 text-ink-2 transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <Image src="/logo.png" alt="CalorieFlow" width={36} height={36} className="rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-ink leading-tight">{T.historyTitle}</h1>
            <p className="text-ink-3 text-xs">{T.allMeals}</p>
          </div>
          <Link href="/weight" title={lang === "he" ? "מעקב משקל" : "Weight tracking"}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-canvas hover:bg-line/60 text-ink-2 text-xs font-bold transition-colors">
            <Scale className="w-4 h-4" />
            <span className="hidden sm:inline">{lang === "he" ? "משקל" : "Weight"}</span>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-5 pb-12">
        {/* Stats */}
        {!loading && totalDays > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: T.trackedDays, value: String(totalDays), icon: <CalendarDays className="w-4 h-4" />, chip: "bg-protein/10 text-protein" },
              { label: T.avgCalories, value: avgCalories.toLocaleString(), icon: <Flame className="w-4 h-4" />, chip: "bg-fat/10 text-fat" },
              { label: T.totalMeals, value: String(totalMeals), icon: <TrendingUp className="w-4 h-4" />, chip: "bg-brand-50 text-brand-600" },
              { label: T.deficit, value: String(deficitDays), icon: <TrendingDown className="w-4 h-4" />, chip: "bg-carbs/10 text-carbs" },
            ].map((s) => (
              <div key={s.label} className="bg-surface rounded-(--radius-card) border border-line shadow-(--shadow-card) p-4 flex flex-col gap-2">
                <div className={`w-8 h-8 rounded-xl ${s.chip} flex items-center justify-center`}>
                  {s.icon}
                </div>
                <p className="text-2xl font-bold text-ink tabular-nums">{s.value}</p>
                <p className="text-xs text-ink-3 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Day list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-surface rounded-(--radius-card) animate-pulse border border-line" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="bg-surface rounded-(--radius-card) border border-line shadow-(--shadow-card) p-14 text-center">
            <div className="w-16 h-16 bg-canvas rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-8 h-8 text-ink-3/60" />
            </div>
            <p className="text-ink font-bold text-lg">{T.noHistory}</p>
            <p className="text-ink-3 text-sm mt-1">{T.noHistoryDesc}</p>
            <button onClick={() => router.push("/")}
              className="mt-5 px-6 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-colors">
              {T.addFirst}
            </button>
          </div>
        ) : (
          grouped.map(({ label, days }) => (
            <section key={label}>
              <h2 className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-3 px-1">{label}</h2>
              <div className="flex flex-col gap-2">
                {days.map((day) => {
                  const { day: dayNum, weekday } = formatDate(day.date, lang);
                  const isToday2 = day.date === today;
                  const goal = day.goal_calories ?? defaultGoal;
                  const burned = day.calories_burned ?? 0;
                  const net = day.calories - burned;
                  const diff = goal - net;
                  const isDeficit = diff > 0;
                  const pct = Math.min((day.calories / goal) * 100, 100);

                  return (
                    <button key={day.date} onClick={() => router.push(`/?date=${day.date}`)}
                      className="w-full text-start bg-surface rounded-(--radius-card) border border-line shadow-(--shadow-card) hover:border-brand-500/40 transition-all duration-150 overflow-hidden group">
                      <div className="p-4 flex items-center gap-3">
                        {/* Date badge */}
                        <div className={`flex flex-col items-center justify-center w-12 h-14 rounded-xl shrink-0 ${isToday2 ? "bg-brand-600 text-white" : "bg-canvas text-ink-2"}`}>
                          <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{weekday}</span>
                          <span className="text-xl font-bold leading-tight tabular-nums">{dayNum}</span>
                          {isToday2 && <span className="text-[8px] font-bold uppercase opacity-80">{T.today}</span>}
                        </div>

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-lg font-bold text-ink tabular-nums">
                              {day.calories.toLocaleString()} <span className="text-sm font-normal text-ink-3">{T.kcal}</span>
                            </span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${isDeficit ? "bg-brand-50 text-brand-700" : "bg-over/10 text-over"}`}>
                              {isDeficit ? `↓${Math.abs(Math.round(diff))}` : `↑${Math.abs(Math.round(diff))}`} {isDeficit ? T.deficit : T.surplus}
                            </span>
                          </div>
                          <div className="h-1.5 bg-line/60 rounded-full overflow-hidden mb-1.5">
                            <div className={`h-full rounded-full transition-all ${isDeficit ? "bg-good" : "bg-over"}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center gap-x-3 gap-y-0.5 text-xs text-ink-3 flex-wrap tabular-nums">
                            <span className="flex items-center gap-1 shrink-0"><UtensilsCrossed className="w-3 h-3" />{day.count} {T.meals}</span>
                            <span className="shrink-0">P {day.protein}g</span>
                            <span className="shrink-0">C {day.carbs}g</span>
                            <span className="shrink-0">F {day.fat}g</span>
                          </div>
                        </div>

                        {/* In RTL this chevron is on the left (inline-start), pointing left = "enter" */}
                        <ArrowRight className="w-4 h-4 text-ink-3/60 group-hover:text-brand-600 transition-colors shrink-0 rtl:rotate-0 ltr:rotate-180" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>
      <footer className="pb-6 text-center text-xs text-ink-3/60" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>{T.poweredBy}</footer>
    </div>
  );
}
