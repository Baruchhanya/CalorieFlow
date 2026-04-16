"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, Trash2, RefreshCw, ChevronRight, ChevronLeft,
  History, LogOut, Globe,
} from "lucide-react";
import DailySummary from "@/components/DailySummary";
import DeficitCard from "@/components/DeficitCard";
import FoodInput from "@/components/FoodInput";
import MealCard from "@/components/MealCard";
import EditModal from "@/components/EditModal";
import { MealEntry } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDateHebrew(dateStr: string, lang: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString(lang === "he" ? "he-IL" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function HomeClient({ initialDate }: { initialDate: string }) {
  const router = useRouter();
  const { T, lang, toggleLang } = useLang();
  const [date, setDate] = useState(initialDate);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<MealEntry | null>(null);
  const [clearing, setClearing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [goalCalories, setGoalCalories] = useState(2000);
  const [caloriesBurned, setCaloriesBurned] = useState(0);

  const today = getToday();
  const isToday = date === today;
  const isPast = date < today;

  // Fetch user info + settings
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (d.daily_goal_calories) setGoalCalories(d.daily_goal_calories);
    }).catch(() => {});
  }, []);

  // Fetch daily activity (calories burned) when date changes
  useEffect(() => {
    fetch(`/api/activity?date=${date}`).then(r => r.json()).then(d => {
      setCaloriesBurned(d.calories_burned ?? 0);
    }).catch(() => {});
  }, [date]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/entries?date=${date}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const navigateDate = (delta: number) => {
    const newDate = offsetDate(date, delta);
    if (newDate > today) return;
    setDate(newDate);
    router.replace(`/?date=${newDate}`, { scroll: false });
  };

  const goToToday = () => {
    setDate(today);
    router.replace("/", { scroll: false });
  };

  const handleDelete = (id: string) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const handleSave = (updated: MealEntry) => {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setEditingEntry(null);
  };

  const handleClearAll = async () => {
    if (!entries.length) return;
    if (!confirm(T.clearAllConfirm(entries.length))) return;
    setClearing(true);
    try {
      await Promise.all(entries.map((e) => fetch(`/api/entries/${e.id}`, { method: "DELETE" })));
      setEntries([]);
    } finally { setClearing(false); }
  };

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f1f5f9" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 shadow-sm"
        style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}>
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Logo + date */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight shrink-0">
                  {T.appName}
                </h1>
                <a href="/history"
                  className="flex items-center gap-1 text-xs text-emerald-100 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors shrink-0">
                  <History className="w-3.5 h-3.5" />{T.history}
                </a>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
                <p className="text-emerald-100 text-xs truncate">
                  {formatDateHebrew(date, lang)}
                  {isToday && (
                    <span className="mr-1.5 bg-white/20 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                      {T.today}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Date navigation */}
              <button onClick={() => navigateDate(-1)} title={T.prevDay}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              {!isToday && (
                <button onClick={goToToday}
                  className="px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors">
                  {T.today}
                </button>
              )}
              <button onClick={() => navigateDate(1)} disabled={isToday} title={T.nextDay}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="w-px h-5 bg-white/20 mx-0.5" />

              {/* Lang toggle */}
              <button onClick={toggleLang} title="Toggle language"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors">
                <Globe className="w-3.5 h-3.5" />
                {lang === "he" ? "EN" : "עב"}
              </button>

              {/* Refresh */}
              <button onClick={fetchEntries} title={T.refresh}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Clear all */}
              {entries.length > 0 && (
                <button onClick={handleClearAll} disabled={clearing} title={T.clearAll}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-red-400/40 text-white transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Sign out */}
              <button onClick={handleSignOut} title={T.signOut}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* User email strip */}
          {userEmail && (
            <p className="text-emerald-100/60 text-[10px] mt-1 truncate">{userEmail}</p>
          )}
        </div>
      </header>

      {/* Past-day notice */}
      {isPast && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-700 flex items-center justify-between">
            <span>{T.viewingPastDay(formatDateHebrew(date, lang))}</span>
            <button onClick={goToToday} className="text-amber-600 font-semibold hover:underline text-xs">
              {T.backToToday}
            </button>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
        <DailySummary entries={entries} goalCalories={goalCalories} />
        <DeficitCard
          consumed={entries.reduce((s, e) => s + e.calories, 0)}
          burned={caloriesBurned}
          goalCalories={goalCalories}
          date={date}
          onBurnedChange={setCaloriesBurned}
          onGoalChange={setGoalCalories}
        />
        <FoodInput onEntriesAdded={fetchEntries} currentDate={date} />

        {/* Meal list */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-700">
              {isToday ? T.mealsToday : T.mealsDay}
              {entries.length > 0 && (
                <span className="mr-2 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {entries.length}
                </span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-white rounded-xl animate-pulse border border-slate-100" style={{ opacity: 1 - i * 0.2 }} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
              <div className="text-4xl mb-3">🍽️</div>
              <p className="text-slate-500 font-medium">{isToday ? T.noMeals : T.noMealsHistoryDay}</p>
              <p className="text-slate-400 text-sm mt-1">{isToday ? T.noMealsDesc : T.noMealsHistoryDesc}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map((entry) => (
                <MealCard key={entry.id} entry={entry} onDelete={handleDelete} onEdit={setEditingEntry} />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="mt-8 pb-6 text-center text-xs text-slate-400">{T.poweredBy}</footer>

      <EditModal entry={editingEntry} onSave={handleSave} onClose={() => setEditingEntry(null)} />
    </div>
  );
}
