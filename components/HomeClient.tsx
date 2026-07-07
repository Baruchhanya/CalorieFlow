"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  CalendarDays, Trash2, RefreshCw, ChevronRight, ChevronLeft,
  LogOut, Globe, User, Scale, History, Home, Shield,
} from "lucide-react";
import DailySummary from "@/components/DailySummary";
import DeficitCard from "@/components/DeficitCard";
import CalorieHistorySection from "@/components/CalorieHistorySection";
import FoodInput from "@/components/FoodInput";
import MealCard from "@/components/MealCard";
import EditModal from "@/components/EditModal";
import ProfileModal from "@/components/ProfileModal";
import UntrackedDayCard from "@/components/UntrackedDayCard";
import YesterdayBurnModal from "@/components/YesterdayBurnModal";
import MorningWeightModal from "@/components/MorningWeightModal";
import WeeklyWeightCard from "@/components/WeeklyWeightCard";
import { MealEntry, MealPreset, UserProfile, effectiveProteinGoal } from "@/types";
import type { HistorySuggestion } from "@/types";
import type { BalanceHistoryResponse } from "@/app/api/balance-history/route";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";
import { getToday, offsetDate, formatDate } from "@/lib/dates";

function getInitials(email: string) {
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

// Defined fallback so secondary children render their empty state instead of
// hanging in a skeleton when the secondary fetch fails or returns nothing.
const EMPTY_BALANCE_HISTORY: BalanceHistoryResponse = {
  days7: [],
  chart_days: [],
  weekly_avg: null,
  weekly_total: null,
  monthly_avg: null,
  monthly_total: null,
};

// Session cache of critical payloads keyed by date, so revisiting a date
// renders instantly (stale-while-revalidate — the network refresh still runs).
type CriticalPayload = {
  entries: MealEntry[];
  calories_burned: number;
  daily_goal_calories?: number;
};
const criticalCache = new Map<string, CriticalPayload>();
const CRITICAL_CACHE_MAX = 30;

// Bottom nav item
function NavItem({ icon, label, active, onClick, href }: {
  icon: React.ReactNode; label: string; active?: boolean;
  onClick?: () => void; href?: string;
}) {
  const cls = `flex flex-col items-center gap-0.5 px-4 py-1 rounded-full transition-colors duration-200 ${
    active ? "text-brand-600" : "text-ink-3 hover:text-ink-2"
  }`;
  if (href) return (
    <Link href={href} className={cls}>
      <span className={`p-1.5 rounded-full transition-colors ${active ? "bg-brand-50" : ""}`}>{icon}</span>
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  );
  return (
    <button onClick={onClick} className={cls}>
      <span className={`p-1.5 rounded-full transition-colors ${active ? "bg-brand-50" : ""}`}>{icon}</span>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}

export default function HomeClient({ initialDate }: { initialDate: string }) {
  const router = useRouter();
  const { T, lang, toggleLang } = useLang();
  const { showToast } = useToast();
  const ptrRef = useRef({ startY: 0, active: false });
  const [date, setDate] = useState(initialDate);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<MealEntry | null>(null);
  const [clearing, setClearing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [goalCalories, setGoalCalories] = useState(1820);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryResponse | undefined>(undefined);
  const [mealPresets, setMealPresets] = useState<MealPreset[] | undefined>(undefined);
  const [mealSuggestions, setMealSuggestions] = useState<HistorySuggestion[] | undefined>(undefined);
  // Yesterday burn-calories prompt state
  const [yesterdayPrompt, setYesterdayPrompt] = useState<{ date: string; initial: number; baseGoal: number } | null>(null);
  // Morning weight prompt state
  const [morningWeightPrompt, setMorningWeightPrompt] = useState<{ date: string } | null>(null);
  // Track whether stable (non-date-specific) data has been loaded
  const stableLoadedRef = useRef(false);
  const yesterdayCheckedRef = useRef(false);
  const morningWeightCheckedRef = useRef(false);
  // Monotonic request id — guards against stale critical/secondary responses
  // overwriting newer data when the user changes date / refreshes quickly.
  const reqSeqRef = useRef(0);

  const today = getToday();
  const isToday = date === today;
  const isPast = date < today;
  const totalCalories = useMemo(() => entries.reduce((s, e) => s + e.calories, 0), [entries]);
  const goalProtein = useMemo(() => effectiveProteinGoal(userProfile), [userProfile]);

  // Handle iOS keyboard popping up bottom nav
  useEffect(() => {
    const handleFocus = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        document.documentElement.style.setProperty("--keyboard-offset", "100%");
      }
    };
    
    const handleBlur = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        document.documentElement.style.setProperty("--keyboard-offset", "0");
      }
    };

    document.addEventListener("focus", handleFocus, true);
    document.addEventListener("blur", handleBlur, true);
    
    // Also listen to visual viewport resize (iOS 13+)
    if (window.visualViewport) {
      const handleResize = () => {
        if (window.visualViewport!.height < window.innerHeight) {
          // Keyboard is likely open
          document.documentElement.style.setProperty("--keyboard-offset", "100%");
        } else {
          document.documentElement.style.setProperty("--keyboard-offset", "0");
        }
      };
      window.visualViewport.addEventListener("resize", handleResize);
      return () => {
        document.removeEventListener("focus", handleFocus, true);
        document.removeEventListener("blur", handleBlur, true);
        window.visualViewport?.removeEventListener("resize", handleResize);
      };
    }

    return () => {
      document.removeEventListener("focus", handleFocus, true);
      document.removeEventListener("blur", handleBlur, true);
    };
  }, []);

  // Secondary (non-critical) data for a given date — never blocks the UI.
  // Tagged with a request id so a stale response can't overwrite newer data.
  const loadSecondary = useCallback((targetDate: string, seq: number) => {
    fetch(`/api/init?date=${targetDate}&phase=secondary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (seq !== reqSeqRef.current) return;
        // Children no longer self-fetch, so always resolve their props to a
        // defined value — even on a failed/empty response — so their skeletons
        // clear instead of hanging forever.
        setIsAdmin(!!d?.is_admin);
        setBalanceHistory(d?.balance_history ?? EMPTY_BALANCE_HISTORY);
        setMealPresets(Array.isArray(d?.meal_presets) ? d.meal_presets : []);
        setMealSuggestions(Array.isArray(d?.meal_suggestions) ? d.meal_suggestions : []);
      })
      .catch(() => {
        if (seq !== reqSeqRef.current) return;
        setBalanceHistory(EMPTY_BALANCE_HISTORY);
        setMealPresets([]);
        setMealSuggestions([]);
      });
  }, []);

  // Critical data for a given date — gates the meal-list / summary skeletons.
  const loadCritical = useCallback(async (targetDate: string, seq: number) => {
    try {
      const res = await fetch(`/api/init?date=${targetDate}&phase=critical`);
      if (!res.ok) return;
      const d = await res.json();
      if (seq !== reqSeqRef.current) return; // a newer request superseded us
      const entries = Array.isArray(d.entries) ? d.entries : [];
      setEntries(entries);
      setCaloriesBurned(d.calories_burned ?? 0);
      if (typeof d.daily_goal_calories === "number") setGoalCalories(d.daily_goal_calories);
      if (criticalCache.size >= CRITICAL_CACHE_MAX) criticalCache.clear();
      criticalCache.set(targetDate, {
        entries,
        calories_burned: d.calories_burned ?? 0,
        daily_goal_calories: typeof d.daily_goal_calories === "number" ? d.daily_goal_calories : undefined,
      });
      if (!stableLoadedRef.current) {
        setUserEmail(d.user?.email ?? null);
        setUserProfile(d.profile ?? null);
        if (!d.profile?.weight_kg) setShowProfile(true);
        stableLoadedRef.current = true;
      }
    } catch { /* silent */ }
    finally {
      if (seq === reqSeqRef.current) setLoading(false);
    }
  }, []);

  // Unified refresh: critical unblocks the UI; secondary fills in below the fold.
  // Used for first load, date changes, and pull-to-refresh alike.
  const refresh = useCallback((targetDate: string) => {
    const seq = ++reqSeqRef.current;
    const cached = criticalCache.get(targetDate);
    if (cached) {
      // Render instantly from cache; the fetch below still revalidates.
      setEntries(cached.entries);
      setCaloriesBurned(cached.calories_burned);
      if (typeof cached.daily_goal_calories === "number") setGoalCalories(cached.daily_goal_calories);
      setLoading(false);
    } else {
      setLoading(true);
    }
    loadSecondary(targetDate, seq);
    loadCritical(targetDate, seq);
  }, [loadCritical, loadSecondary]);

  useEffect(() => {
    refresh(date);
  }, [date, refresh]);

  // Yesterday-burn morning prompt: show once per day unless filled after 23:00 yesterday
  useEffect(() => {
    if (yesterdayCheckedRef.current) return;
    if (!stableLoadedRef.current) return;
    yesterdayCheckedRef.current = true;

    const now = new Date();
    const yDate = new Date(now);
    yDate.setDate(yDate.getDate() - 1);
    const yStr = `${yDate.getFullYear()}-${String(yDate.getMonth()+1).padStart(2,"0")}-${String(yDate.getDate()).padStart(2,"0")}`;

    try {
      const handled = localStorage.getItem("cf_yesterday_burn_handled");
      if (handled === today) return;
    } catch { /* ignore */ }

    fetch(`/api/activity?date=${yStr}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const deadline = new Date(yDate);
        deadline.setHours(23, 0, 0, 0);
        const updatedAt = data.updated_at ? new Date(data.updated_at) : null;
        if (updatedAt && updatedAt >= deadline) return;
        setYesterdayPrompt({
          date: yStr,
          initial: data.calories_burned ?? 0,
          baseGoal: typeof data.daily_goal_calories === "number" ? data.daily_goal_calories : goalCalories,
        });
      })
      .catch(() => { /* silent */ });
  }, [loading, today]);

  const markYesterdayHandled = useCallback(() => {
    try { localStorage.setItem("cf_yesterday_burn_handled", today); } catch { /* ignore */ }
  }, [today]);

  // Morning weight prompt: 05:00–12:00 local, once per day, only if today has no weight entry
  useEffect(() => {
    if (morningWeightCheckedRef.current) return;
    if (!stableLoadedRef.current) return;
    morningWeightCheckedRef.current = true;

    const hour = new Date().getHours();
    if (hour < 5 || hour >= 12) return;

    try {
      const handled = localStorage.getItem("cf_morning_weight_handled");
      if (handled === today) return;
    } catch { /* ignore */ }

    fetch("/api/weight", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((entries: { date: string }[] | null) => {
        if (!Array.isArray(entries)) return;
        if (entries.some((e) => e.date === today)) return;
        setMorningWeightPrompt({ date: today });
      })
      .catch(() => { /* silent */ });
  }, [loading, today]);

  const markMorningWeightHandled = useCallback(() => {
    try { localStorage.setItem("cf_morning_weight_handled", today); } catch { /* ignore */ }
  }, [today]);

  const handleMorningWeightSaved = useCallback(() => {
    markMorningWeightHandled();
    setMorningWeightPrompt(null);
  }, [markMorningWeightHandled]);

  const handleMorningWeightSkip = useCallback(() => {
    markMorningWeightHandled();
    setMorningWeightPrompt(null);
  }, [markMorningWeightHandled]);

  const handleYesterdayBurnSaved = useCallback((burned: number, savedDate: string) => {
    markYesterdayHandled();
    setYesterdayPrompt(null);
    criticalCache.delete(savedDate);
    // If currently viewing the day that was just updated, reflect it
    if (savedDate === date) setCaloriesBurned(burned);
    // Refresh balance history since yesterday's deficit may have changed
    fetch("/api/balance-history")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setBalanceHistory(data); })
      .catch(() => { /* silent */ });
  }, [date, markYesterdayHandled]);

  const handleYesterdayBurnSkip = useCallback(() => {
    markYesterdayHandled();
    setYesterdayPrompt(null);
  }, [markYesterdayHandled]);

  // For pull-to-refresh / header refresh — full phased refresh of the current
  // date: critical data updates the visible UI first, secondary fills in after.
  const fetchEntries = useCallback(() => {
    refresh(date);
  }, [refresh, date]);

  /* Pull-down to refresh (mobile): when at top of page, drag down ~100px */
  useEffect(() => {
    const TH = 100;
    const onStart = (e: TouchEvent) => {
      if (window.scrollY <= 8) {
        ptrRef.current.startY = e.touches[0].clientY;
        ptrRef.current.active = true;
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (!ptrRef.current.active) return;
      ptrRef.current.active = false;
      if (window.scrollY > 8) return;
      const dy = e.changedTouches[0].clientY - ptrRef.current.startY;
      if (dy > TH) {
        fetchEntries();
        showToast(lang === "he" ? "הנתונים עודכנו" : "Data refreshed", "success");
      }
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [fetchEntries, showToast, lang]);

  const navigateDate = (delta: number) => {
    const newDate = offsetDate(date, delta);
    if (newDate > today) return;
    setDate(newDate);
    router.replace(`/?date=${newDate}`, { scroll: false });
  };

  const goToToday = () => { setDate(today); router.replace("/", { scroll: false }); };
  const handleNewEntries = useCallback((newEntries: MealEntry[]) => {
    criticalCache.delete(date);
    setEntries(prev => [...prev, ...newEntries]);
  }, [date]);
  const handleDelete = useCallback((id: string) => {
    criticalCache.delete(date);
    setEntries(prev => prev.filter(e => e.id !== id));
  }, [date]);
  const handleSave = useCallback((updated: MealEntry) => {
    criticalCache.delete(date);
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    setEditingEntry(null);
  }, [date]);

  const handleClearAll = async () => {
    if (!entries.length || !confirm(T.clearAllConfirm(entries.length))) return;
    setClearing(true);
    criticalCache.delete(date);
    const ids = entries.map(e => e.id);
    const previousEntries = entries;
    // Optimistic: clear immediately
    setEntries([]);
    try {
      const res = await fetch("/api/entries", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (res.ok) {
        showToast(lang === "he" ? "כל הרשומות נמחקו" : "All entries removed", "info");
      } else {
        // Rollback on failure
        setEntries(previousEntries);
        showToast(lang === "he" ? "שגיאה במחיקה" : "Failed to delete", "error");
      }
    } catch {
      // Rollback on network error
      setEntries(previousEntries);
      showToast(lang === "he" ? "שגיאה במחיקה" : "Failed to delete", "error");
    } finally { setClearing(false); }
  };

  const handleSignOut = async () => { criticalCache.clear(); await createClient().auth.signOut(); router.push("/login"); };

  const setCaloriesBurnedInvalidating = useCallback((burned: number) => {
    criticalCache.delete(date);
    setCaloriesBurned(burned);
  }, [date]);

  const setGoalCaloriesInvalidating = useCallback((goal: number) => {
    criticalCache.delete(date);
    setGoalCalories(goal);
  }, [date]);

  const refreshBalanceHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/balance-history");
      if (res.ok) setBalanceHistory(await res.json());
    } catch { /* silent */ }
  }, []);

  return (
    <div className="min-h-screen pb-28 sm:pb-8" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 bg-surface border-b border-line">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">

            {/* Left: logo + name */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                <Image src="/logo.png" alt="CF" width={32} height={32} className="w-full h-full object-cover" />
              </div>
              <h1 className="text-base font-bold leading-tight text-ink">
                {T.appName}
              </h1>
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-1 shrink-0">

              {/* History + Weight – שכפול של ה-bottom nav, מציגים רק בדסקטופ */}
              <Link href="/history" title={T.history}
                className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors text-ink-2 hover:bg-canvas">
                <History className="w-3.5 h-3.5" />
                <span>{T.history}</span>
              </Link>
              <Link href="/weight" title={lang === "he" ? "מעקב משקל וגרפים" : "Weight & charts"}
                className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors text-ink-2 hover:bg-canvas">
                <Scale className="w-3.5 h-3.5" />
                <span>{lang === "he" ? "משקל" : "Weight"}</span>
              </Link>

              {isAdmin && (
                <Link href="/admin" title={T.adminPageTitle}
                  className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors text-warn hover:bg-warn/10">
                  <Shield className="w-3.5 h-3.5" />
                  <span>{T.adminNavLabel}</span>
                </Link>
              )}

              <div className="hidden sm:block w-px h-4 mx-0.5 bg-line" />

              <button onClick={toggleLang}
                className="px-2 py-1.5 rounded-lg text-xs font-bold transition-colors text-ink-2 hover:bg-canvas">
                <Globe className="w-3.5 h-3.5 inline me-0.5" />
                {lang === "he" ? "EN" : "עב"}
              </button>

              <button onClick={fetchEntries} title={T.refresh}
                className="p-1.5 rounded-lg transition-colors hidden sm:block text-ink-2 hover:bg-canvas">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              {entries.length > 0 && (
                <button onClick={handleClearAll} disabled={clearing}
                  className="p-1.5 rounded-lg transition-colors hidden sm:block text-ink-3 hover:text-over hover:bg-over/10">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Avatar / sign out */}
              {userEmail && (
                <button onClick={handleSignOut} title={`${T.signOut} · ${userEmail}`}
                  className="w-8 h-8 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {getInitials(userEmail)}
                </button>
              )}
            </div>
          </div>

          {/* ── DATE BAR ── */}
          <div className="flex items-center justify-between gap-2 pt-1 pb-1">
            <button onClick={() => navigateDate(-1)} title={T.prevDay}
              className="p-2 rounded-lg transition-colors shrink-0 bg-canvas hover:bg-line/60 active:bg-line text-ink-2">
              <ChevronRight className="w-5 h-5" />
            </button>

            <label className="relative flex-1 flex items-center justify-center gap-2 cursor-pointer select-none group">
              <CalendarDays className="w-4 h-4 shrink-0 text-ink-3" />
              <span className="font-bold text-sm text-center leading-tight text-ink tabular-nums">
                {formatDate(date, lang)}
              </span>
              {isToday && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0 bg-brand-50 text-brand-700">
                  {T.today}
                </span>
              )}
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => {
                  if (e.target.value) {
                    setDate(e.target.value);
                    router.replace(`/?date=${e.target.value}`, { scroll: false });
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              />
            </label>

            <button onClick={() => navigateDate(1)} disabled={isToday} title={T.nextDay}
              className="p-2 rounded-lg transition-colors disabled:opacity-25 shrink-0 bg-canvas hover:bg-line/60 active:bg-line text-ink-2">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>

      </header>

      {/* Past-day notice */}
      {isPast && (
        <div className="max-w-2xl mx-auto px-4 pt-3 animate-slide-up">
          <div className="bg-warn/10 border border-warn/20 rounded-xl px-4 py-2.5 text-sm text-warn flex items-center justify-between">
            <span>{T.viewingPastDay(formatDate(date, lang))}</span>
            <button onClick={goToToday} className="text-warn font-bold hover:underline text-xs shrink-0 ms-2">{T.backToToday}</button>
          </div>
        </div>
      )}

      {/* ── MAIN ── */}
      <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">

        <DailySummary
          entries={entries}
          goalCalories={goalCalories}
          caloriesBurned={caloriesBurned}
          goalProtein={goalProtein}
          onGoalCaloriesChange={isPast ? undefined : setGoalCaloriesInvalidating}
        />

        <FoodInput
          onEntriesAdded={handleNewEntries}
          currentDate={date}
          initialPresets={mealPresets}
          initialSuggestions={mealSuggestions}
        />

        <DeficitCard
          consumed={totalCalories} burned={caloriesBurned} goalCalories={goalCalories}
          date={date} onBurnedChange={setCaloriesBurnedInvalidating} onGoalChange={isPast ? undefined : setGoalCaloriesInvalidating}
        />

        <CalorieHistorySection initialData={balanceHistory} />

        {/* Weekly weight average — links to the full weight tracker */}
        <WeeklyWeightCard />

        {/* Meal list */}
        <section className="animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest flex items-center gap-2">
              {lang === "he" ? (isToday ? "מה אכלת היום" : "מה אכלת") : (isToday ? "Today's Log" : "Daily Log")}
              {entries.length > 0 && (
                <span className="bg-line/60 text-ink-2 text-[10px] font-bold px-2 py-0.5 rounded-full normal-case tracking-normal tabular-nums">
                  {entries.length} {lang === "he" ? "רשומות" : "entries"}
                </span>
              )}
            </h2>
            {entries.length > 0 && (
              <button onClick={handleClearAll} disabled={clearing}
                className="text-xs text-ink-3 hover:text-over transition-colors flex items-center gap-1">
                <Trash2 className="w-3 h-3" />{T.clearAll}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-2.5">
              {[1,2,3].map(i => (
                <div key={i} className="h-20 bg-surface rounded-(--radius-card) animate-pulse-soft border border-line" style={{ opacity: 1 - i * 0.25 }} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <>
              <div className="bg-surface rounded-(--radius-card) border border-line shadow-(--shadow-card) p-12 text-center animate-fade-in">
                <div className="w-20 h-20 mx-auto mb-4 opacity-15">
                  <Image src="/logo.png" alt="CF" width={80} height={80} className="rounded-3xl" />
                </div>
                <p className="text-ink font-bold text-base">{isToday ? T.noMeals : T.noMealsHistoryDay}</p>
                <p className="text-ink-3 text-sm mt-1">{isToday ? T.noMealsDesc : T.noMealsHistoryDesc}</p>
              </div>
              {isPast && (
                <UntrackedDayCard date={date} onSaved={refreshBalanceHistory} />
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map((entry, i) => (
                <div key={entry.id} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <MealCard entry={entry} onDelete={handleDelete} onEdit={setEditingEntry} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="pb-28 sm:pb-8 text-center text-xs text-ink-3/60 mt-4">{T.poweredBy}</footer>

      {/* ── BOTTOM NAV (mobile) ── */}
      <nav className="fixed z-40 sm:hidden inset-x-4 mx-auto max-w-sm rounded-full bg-surface border border-line shadow-lg transition-transform duration-300"
        style={{
          bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
          transform: "translateY(var(--keyboard-offset, 0))",
        }}>
        <div className="flex items-center justify-around px-2 py-1.5">
          <NavItem icon={<Home className="w-5 h-5" />} label={lang === "he" ? "היום" : "Today"} active href="/" />
          <NavItem icon={<Scale className="w-5 h-5" />} label={lang === "he" ? "משקל" : "Weight"} href="/weight" />
          <NavItem icon={<History className="w-5 h-5" />} label={lang === "he" ? "היסטוריה" : "History"} href="/history" />
          {isAdmin && (
            <NavItem icon={<Shield className="w-5 h-5" />} label={T.adminNavLabel} href="/admin" />
          )}
          <NavItem icon={<User className="w-5 h-5" />} label={lang === "he" ? "פרופיל" : "Profile"}
            onClick={() => setShowProfile(true)}
            active={showProfile}
          />
        </div>
      </nav>

      <EditModal entry={editingEntry} onSave={handleSave} onClose={() => setEditingEntry(null)} />

      {showProfile && (
        <ProfileModal
          initialProfile={userProfile}
          dailyGoalCalories={goalCalories}
          isFirstTime={!userProfile?.weight_kg}
          onSave={(p) => { setUserProfile(p); setShowProfile(false); }}
          onDailyGoalSaved={setGoalCalories}
          onClose={() => setShowProfile(false)}
        />
      )}

      {morningWeightPrompt && (
        <MorningWeightModal
          date={morningWeightPrompt.date}
          formattedDate={formatDate(morningWeightPrompt.date, lang)}
          onSaved={handleMorningWeightSaved}
          onClose={handleMorningWeightSkip}
        />
      )}

      {!morningWeightPrompt && yesterdayPrompt && (
        <YesterdayBurnModal
          date={yesterdayPrompt.date}
          formattedDate={formatDate(yesterdayPrompt.date, lang)}
          initialValue={yesterdayPrompt.initial}
          baseGoal={yesterdayPrompt.baseGoal}
          onSaved={handleYesterdayBurnSaved}
          onClose={handleYesterdayBurnSkip}
        />
      )}
    </div>
  );
}
