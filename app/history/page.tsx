"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setDefaultGoal(typeof d.daily_goal_calories === "number" ? d.daily_goal_calories : 1820))
      .catch(() => {});
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
  const deficitDays = history.filter(d => d.calories < (d.goal_calories ?? defaultGoal)).length;
  const grouped = groupByMonth(history, lang);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push("/")}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <Image src="/logo.png" alt="CalorieFlow" width={36} height={36} className="rounded-xl shadow-sm shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-white leading-tight">{T.historyTitle}</h1>
            <p className="text-emerald-100 text-xs">{T.allMeals}</p>
          </div>
          <a href="/weight" title={lang === "he" ? "מעקב משקל" : "Weight tracking"}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors">
            <Scale className="w-4 h-4" />
            <span className="hidden sm:inline">{lang === "he" ? "משקל" : "Weight"}</span>
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-5 pb-12">
        {/* Stats */}
        {!loading && totalDays > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: T.trackedDays, value: String(totalDays), icon: <CalendarDays className="w-4 h-4" />, cls: "bg-blue-500", light: "bg-blue-50 text-blue-700" },
              { label: T.avgCalories, value: avgCalories.toLocaleString(), icon: <Flame className="w-4 h-4" />, cls: "bg-amber-500", light: "bg-amber-50 text-amber-700" },
              { label: T.totalMeals, value: String(totalMeals), icon: <TrendingUp className="w-4 h-4" />, cls: "bg-emerald-500", light: "bg-emerald-50 text-emerald-700" },
              { label: T.deficit, value: String(deficitDays), icon: <TrendingDown className="w-4 h-4" />, cls: "bg-violet-500", light: "bg-violet-50 text-violet-700" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-2">
                <div className={`w-8 h-8 rounded-xl ${s.cls} flex items-center justify-center text-white`}>
                  {s.icon}
                </div>
                <p className="text-2xl font-black text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-400 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Day list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-14 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-700 font-bold text-lg">{T.noHistory}</p>
            <p className="text-slate-400 text-sm mt-1">{T.noHistoryDesc}</p>
            <button onClick={() => router.push("/")}
              className="mt-5 px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-colors shadow-sm">
              {T.addFirst}
            </button>
          </div>
        ) : (
          grouped.map(({ label, days }) => (
            <section key={label}>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">{label}</h2>
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
                      className="w-full text-start bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all duration-150 overflow-hidden group">
                      <div className="p-4 flex items-center gap-3">
                        {/* Date badge */}
                        <div className={`flex flex-col items-center justify-center w-12 h-14 rounded-xl shrink-0 ${isToday2 ? "bg-emerald-500 text-white" : "bg-slate-50 text-slate-600"}`}>
                          <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{weekday}</span>
                          <span className="text-xl font-black leading-tight">{dayNum}</span>
                          {isToday2 && <span className="text-[8px] font-bold uppercase opacity-80">{T.today}</span>}
                        </div>

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-lg font-black text-slate-800">
                              {day.calories.toLocaleString()} <span className="text-sm font-normal text-slate-400">{T.kcal}</span>
                            </span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isDeficit ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                              {isDeficit ? `↓${Math.abs(Math.round(diff))}` : `↑${Math.abs(Math.round(diff))}`} {isDeficit ? T.deficit : T.surplus}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                            <div className={`h-full rounded-full transition-all ${isDeficit ? "bg-gradient-to-l from-emerald-400 to-teal-400" : "bg-gradient-to-l from-red-400 to-rose-400"}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center gap-x-3 gap-y-0.5 text-xs text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1 shrink-0"><UtensilsCrossed className="w-3 h-3" />{day.count} {T.meals}</span>
                            <span className="shrink-0">P {day.protein}g</span>
                            <span className="shrink-0">C {day.carbs}g</span>
                            <span className="shrink-0">F {day.fat}g</span>
                          </div>
                        </div>

                        {/* In RTL this chevron is on the left (inline-start), pointing left = "enter" */}
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-400 transition-colors shrink-0 rtl:rotate-0 ltr:rotate-180" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>
      <footer className="pb-6 text-center text-xs text-slate-300" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>{T.poweredBy}</footer>
    </div>
  );
}
