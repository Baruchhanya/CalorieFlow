"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, Trash2, RefreshCw, ChevronRight, ChevronLeft,
  History, LogOut, Globe, Utensils, User,
} from "lucide-react";
import DailySummary from "@/components/DailySummary";
import DeficitCard from "@/components/DeficitCard";
import FoodInput from "@/components/FoodInput";
import MealCard from "@/components/MealCard";
import EditModal from "@/components/EditModal";
import ProfileModal from "@/components/ProfileModal";
import { MealEntry, UserProfile, calcProteinGoal } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";

function getToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(dateStr: string, lang: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString(lang === "he" ? "he-IL" : "en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function getInitials(email: string): string {
  return email.split("@")[0].slice(0, 2).toUpperCase();
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
  const [goalCalories, setGoalCalories] = useState(1820);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  const today = getToday();
  const isToday = date === today;
  const isPast = date < today;

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (d.daily_goal_calories) setGoalCalories(d.daily_goal_calories);
    }).catch(() => {});
    fetch("/api/profile").then(r => r.json()).then((d: UserProfile | null) => {
      setUserProfile(d);
      // Auto-open profile modal on first login (no weight set yet)
      if (!d?.weight_kg) setShowProfile(true);
    }).catch(() => {});
  }, []);

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

  const totalCalories = entries.reduce((s, e) => s + e.calories, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}>
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between gap-2 py-3">
            {/* Left: Logo */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Utensils className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-black text-white tracking-tight leading-none">{T.appName}</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CalendarDays className="w-3 h-3 text-emerald-200 shrink-0" />
                  <p className="text-emerald-100 text-xs truncate leading-none">
                    {formatDate(date, lang)}
                    {isToday && (
                      <span className="ms-1.5 bg-white/25 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-wide uppercase">
                        {T.today}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <a href="/history" title={T.history}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors">
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{T.history}</span>
              </a>

              <div className="w-px h-4 bg-white/20 mx-0.5" />

              <button onClick={() => navigateDate(-1)} title={T.prevDay}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              {!isToday && (
                <button onClick={goToToday}
                  className="px-2 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold transition-colors">
                  {T.today}
                </button>
              )}
              <button onClick={() => navigateDate(1)} disabled={isToday} title={T.nextDay}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-white/20 mx-0.5" />

              <button onClick={toggleLang} title="Toggle language"
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors">
                <Globe className="w-3.5 h-3.5" />
                {lang === "he" ? "EN" : "עב"}
              </button>

              <button onClick={fetchEntries} title={T.refresh}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>

              {entries.length > 0 && (
                <button onClick={handleClearAll} disabled={clearing} title={T.clearAll}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-red-400/40 text-white transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Profile button */}
              <button onClick={() => setShowProfile(true)} title={lang === "he" ? "פרופיל" : "Profile"}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors relative">
                <User className="w-4 h-4" />
                {!userProfile?.weight_kg && (
                  <span className="absolute -top-0.5 -end-0.5 w-2 h-2 bg-amber-400 rounded-full" />
                )}
              </button>

              {/* User avatar + sign out */}
              {userEmail && (
                <button onClick={handleSignOut} title={`${T.signOut} · ${userEmail}`}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center justify-center transition-colors shrink-0 border-2 border-white/30">
                  {getInitials(userEmail)}
                </button>
              )}
              {!userEmail && (
                <button onClick={handleSignOut} title={T.signOut}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Calorie quick-bar */}
        {totalCalories > 0 && (
          <div className="border-t border-white/10">
            <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between">
              <span className="text-emerald-100 text-xs">{T.mealsToday}: {entries.length}</span>
              <span className="text-white text-sm font-black">{Math.round(totalCalories).toLocaleString()} <span className="text-emerald-200 font-normal text-xs">{T.kcal}</span></span>
            </div>
          </div>
        )}
      </header>

      {/* Past-day notice */}
      {isPast && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 text-sm text-amber-700 flex items-center justify-between">
            <span>{T.viewingPastDay(formatDate(date, lang))}</span>
            <button onClick={goToToday} className="text-amber-600 font-semibold hover:underline text-xs shrink-0 ms-2">
              {T.backToToday}
            </button>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4 pb-12">
        <DailySummary entries={entries} goalCalories={goalCalories} goalProtein={calcProteinGoal(userProfile)} />
        <DeficitCard
          consumed={totalCalories}
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
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              {isToday ? T.mealsToday : T.mealsDay}
              {entries.length > 0 && (
                <span className="bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-full normal-case tracking-normal">
                  {entries.length}
                </span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-col gap-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-slate-100" style={{ opacity: 1 - i * 0.25 }} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Utensils className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-slate-600 font-semibold">{isToday ? T.noMeals : T.noMealsHistoryDay}</p>
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

      <footer className="pb-6 text-center text-xs text-slate-300">{T.poweredBy}</footer>

      <EditModal entry={editingEntry} onSave={handleSave} onClose={() => setEditingEntry(null)} />

      {showProfile && (
        <ProfileModal
          initialProfile={userProfile}
          isFirstTime={!userProfile?.weight_kg}
          onSave={(p) => { setUserProfile(p); setShowProfile(false); }}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
