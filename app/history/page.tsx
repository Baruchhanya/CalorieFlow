"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, CalendarDays, Flame, TrendingUp, UtensilsCrossed, ChevronLeft,
} from "lucide-react";
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
    full: date.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
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
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (d.daily_goal_calories) setDefaultGoal(d.daily_goal_calories);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setHistory(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalDays = history.length;
  const avgCalories = totalDays > 0
    ? Math.round(history.reduce((s, d) => s + d.calories, 0) / totalDays) : 0;
  const totalMeals = history.reduce((s, d) => s + d.count, 0);
  const grouped = groupByMonth(history, lang);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f1f5f9" }}>
      <header className="sticky top-0 z-40 shadow-sm"
        style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push("/")}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white">{T.historyTitle}</h1>
            <p className="text-emerald-100 text-xs">{T.allMeals}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-5">
        {/* Stats */}
        {!loading && totalDays > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: T.trackedDays, value: String(totalDays), sub: T.total, icon: <CalendarDays className="w-3.5 h-3.5" />, cls: "bg-blue-50 text-blue-700" },
              { label: T.avgCalories, value: avgCalories.toLocaleString(), sub: T.perDay, icon: <Flame className="w-3.5 h-3.5" />, cls: "bg-amber-50 text-amber-700" },
              { label: T.totalMeals, value: String(totalMeals), sub: T.total, icon: <TrendingUp className="w-3.5 h-3.5" />, cls: "bg-emerald-50 text-emerald-700" },
            ].map((s) => (
              <div key={s.label} className={`${s.cls} rounded-xl p-4`}>
                <div className="flex items-center gap-1.5 text-xs font-semibold opacity-70">{s.icon}{s.label}</div>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-xs opacity-60">{s.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Day list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-white rounded-xl animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-14 text-center">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-slate-500 font-semibold text-lg">{T.noHistory}</p>
            <p className="text-slate-400 text-sm mt-2">{T.noHistoryDesc}</p>
            <button onClick={() => router.push("/")}
              className="mt-5 px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors">
              {T.addFirst}
            </button>
          </div>
        ) : (
          grouped.map(({ label, days }) => (
            <section key={label}>
              <h2 className="text-sm font-bold text-slate-500 mb-2 px-1">{label}</h2>
              <div className="flex flex-col gap-2">
                {days.map((day) => {
                  const { day: dayNum, weekday } = formatDate(day.date, lang);
                  const isToday2 = day.date === today;
                  const goal = day.goal_calories ?? defaultGoal;
                  const burned = day.calories_burned ?? 0;
                  const net = day.calories - burned;
                  const diff = goal - net;
                  const isDeficit = diff > 0;
                  const over = day.calories > goal;
                  const pct = Math.min((day.calories / goal) * 100, 100);
                  return (
                    <button key={day.date} onClick={() => router.push(`/?date=${day.date}`)}
                      className="w-full text-right bg-white rounded-xl border border-slate-100 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all duration-150 p-4 flex items-center gap-4 group">
                      <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl shrink-0 ${isToday2 ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                        <span className="text-xs font-medium">{weekday}</span>
                        <span className="text-lg font-black leading-none">{dayNum}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-lg font-bold ${over ? "text-red-500" : "text-slate-800"}`}>
                            {day.calories.toLocaleString()} {T.kcal}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDeficit ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                            {isDeficit ? `↓ ${Math.abs(Math.round(diff))} ${T.deficit}` : `↑ ${Math.abs(Math.round(diff))} ${T.surplus}`}
                          </span>
                          {isToday2 && (
                            <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">{T.today}</span>
                          )}
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                          <div className={`h-full rounded-full ${over ? "bg-red-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                          <span><UtensilsCrossed className="w-3 h-3 inline ml-0.5" />{day.count} {T.meals}</span>
                          <span>{T.protein.slice(0, 1)}: {day.protein}g</span>
                          <span>{T.carbs.slice(0, 1)}: {day.carbs}g</span>
                          <span>{T.fat.slice(0, 1)}: {day.fat}g</span>
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-emerald-400 transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>
      <footer className="mt-8 pb-6 text-center text-xs text-slate-400">{T.poweredBy}</footer>
    </div>
  );
}
