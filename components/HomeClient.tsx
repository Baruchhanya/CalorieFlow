"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { MealEntry, UserProfile, effectiveProteinGoal } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

function getToday() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}

function formatDate(dateStr: string, lang: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(
    lang === "he" ? "he-IL" : "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );
}

function offsetDate(dateStr: string, days: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getInitials(email: string) {
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

// Bottom nav item
function NavItem({ icon, label, active, onClick, href }: {
  icon: React.ReactNode; label: string; active?: boolean;
  onClick?: () => void; href?: string;
}) {
  const cls = `flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl transition-all duration-200 ${
    active ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"
  }`;
  if (href) return (
    <a href={href} className={cls}>
      <span className={`p-1.5 rounded-xl transition-colors ${active ? "bg-emerald-100" : ""}`}>{icon}</span>
      <span className="text-[10px] font-semibold">{label}</span>
    </a>
  );
  return (
    <button onClick={onClick} className={cls}>
      <span className={`p-1.5 rounded-xl transition-colors ${active ? "bg-emerald-100" : ""}`}>{icon}</span>
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
  const [scrolled, setScrolled] = useState(false);

  const today = getToday();
  const isToday = date === today;
  const isPast = date < today;
  const totalCalories = entries.reduce((s, e) => s + e.calories, 0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Single fetch that loads all startup data (user, entries, settings, profile, activity)
  const fetchAll = useCallback(async (targetDate: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/init?date=${targetDate}`);
      if (!res.ok) return;
      const d = await res.json();
      setUserEmail(d.user?.email ?? null);
      setEntries(Array.isArray(d.entries) ? d.entries : []);
      setGoalCalories(typeof d.daily_goal_calories === "number" ? d.daily_goal_calories : 1820);
      setCaloriesBurned(d.calories_burned ?? 0);
      setUserProfile(d.profile ?? null);
      setIsAdmin(!!d.is_admin);
      if (!d.profile?.weight_kg) setShowProfile(true);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(date); }, [date, fetchAll]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/entries?date=${date}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [date]);

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
  const handleDelete = (id: string) => setEntries(prev => prev.filter(e => e.id !== id));
  const handleSave = (updated: MealEntry) => { setEntries(prev => prev.map(e => e.id === updated.id ? updated : e)); setEditingEntry(null); };

  const handleClearAll = async () => {
    if (!entries.length || !confirm(T.clearAllConfirm(entries.length))) return;
    setClearing(true);
    try {
      await Promise.all(entries.map(e => fetch(`/api/entries/${e.id}`, { method: "DELETE" })));
      setEntries([]);
      showToast(lang === "he" ? "כל הרשומות נמחקו" : "All entries removed", "info");
    } finally { setClearing(false); }
  };

  const handleSignOut = async () => { await createClient().auth.signOut(); router.push("/login"); };

  return (
    <div className="min-h-screen bg-slate-50 pb-28 sm:pb-8" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}>

      {/* ── HEADER ── */}
      <header className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled ? "glass shadow-sm border-b border-white/60" : ""
      }`} style={{ background: scrolled ? undefined : "linear-gradient(135deg,#059669 0%,#0d9488 100%)" }}>
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">

            {/* Left: logo + date */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 shadow-sm ring-2 ring-white/20">
                <Image src="/logo.png" alt="CF" width={32} height={32} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <h1 className={`text-base font-black leading-tight ${scrolled ? "text-slate-800" : "text-white"}`}>
                  {T.appName}
                </h1>
                <div className="flex items-center gap-1">
                  <CalendarDays className={`w-3 h-3 shrink-0 ${scrolled ? "text-slate-400" : "text-emerald-100"}`} />
                  <p className={`text-xs truncate leading-none ${scrolled ? "text-slate-500" : "text-emerald-100"}`}>
                    {formatDate(date, lang)}
                    {isToday && (
                      <span className={`ms-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${scrolled ? "bg-emerald-100 text-emerald-700" : "bg-white/25 text-white"}`}>
                        {T.today}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => navigateDate(-1)} title={T.prevDay}
                className={`p-1.5 rounded-xl transition-colors ${scrolled ? "hover:bg-slate-100 text-slate-600" : "bg-white/10 hover:bg-white/20 text-white"}`}>
                <ChevronRight className="w-4 h-4" />
              </button>
              {!isToday && (
                <button onClick={goToToday}
                  className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-colors ${scrolled ? "bg-emerald-100 text-emerald-700" : "bg-white/20 hover:bg-white/30 text-white"}`}>
                  {T.today}
                </button>
              )}
              <button onClick={() => navigateDate(1)} disabled={isToday} title={T.nextDay}
                className={`p-1.5 rounded-xl transition-colors disabled:opacity-25 ${scrolled ? "hover:bg-slate-100 text-slate-600" : "bg-white/10 hover:bg-white/20 text-white"}`}>
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className={`w-px h-4 mx-0.5 ${scrolled ? "bg-slate-200" : "bg-white/20"}`} />

              {/* History + Weight – חובה בדסקטופ (ה-bottom nav מוסתר מ-sm ומעלה) */}
              <a href="/history" title={T.history}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-semibold transition-colors ${scrolled ? "text-slate-600 hover:bg-slate-100" : "text-white bg-white/10 hover:bg-white/20"}`}>
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{T.history}</span>
              </a>
              <a href="/weight" title={lang === "he" ? "מעקב משקל וגרפים" : "Weight & charts"}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-semibold transition-colors ${scrolled ? "text-slate-600 hover:bg-slate-100" : "text-white bg-white/10 hover:bg-white/20"}`}>
                <Scale className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{lang === "he" ? "משקל" : "Weight"}</span>
              </a>

              {isAdmin && (
                <a href="/admin" title={T.adminPageTitle}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-semibold transition-colors ${scrolled ? "text-amber-700 hover:bg-amber-50" : "text-white bg-amber-400/30 hover:bg-amber-400/50"}`}>
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{T.adminNavLabel}</span>
                </a>
              )}

              <div className={`w-px h-4 mx-0.5 ${scrolled ? "bg-slate-200" : "bg-white/20"}`} />

              <button onClick={toggleLang}
                className={`px-2 py-1.5 rounded-xl text-xs font-bold transition-colors ${scrolled ? "hover:bg-slate-100 text-slate-600" : "bg-white/10 hover:bg-white/20 text-white"}`}>
                <Globe className="w-3.5 h-3.5 inline me-0.5" />
                {lang === "he" ? "EN" : "עב"}
              </button>

              <button onClick={fetchEntries} title={T.refresh}
                className={`p-1.5 rounded-xl transition-colors hidden sm:block ${scrolled ? "hover:bg-slate-100 text-slate-600" : "bg-white/10 hover:bg-white/20 text-white"}`}>
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              {entries.length > 0 && (
                <button onClick={handleClearAll} disabled={clearing}
                  className={`p-1.5 rounded-xl transition-colors hidden sm:block ${scrolled ? "hover:bg-red-50 text-slate-400 hover:text-red-400" : "bg-white/10 hover:bg-red-400/30 text-white"}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Avatar / sign out */}
              {userEmail && (
                <button onClick={handleSignOut} title={`${T.signOut} · ${userEmail}`}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm ring-2 ring-white/30">
                  {getInitials(userEmail)}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Calorie strip */}
        {totalCalories > 0 && !scrolled && (
          <div className="border-t border-white/10">
            <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between">
              <span className="text-emerald-100 text-xs">
                {entries.length} {lang === "he" ? "רשומות מזון" : "food entries"}
              </span>
              <span className="text-white text-sm font-black">
                {Math.round(totalCalories).toLocaleString()}
                <span className="text-emerald-200 font-normal text-xs ms-1">{T.kcal}</span>
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Past-day notice */}
      {isPast && (
        <div className="max-w-2xl mx-auto px-4 pt-3 animate-slide-up">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 text-sm text-amber-700 flex items-center justify-between">
            <span>{T.viewingPastDay(formatDate(date, lang))}</span>
            <button onClick={goToToday} className="text-amber-600 font-bold hover:underline text-xs shrink-0 ms-2">{T.backToToday}</button>
          </div>
        </div>
      )}

      {/* ── MAIN ── */}
      <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">

        <FoodInput onEntriesAdded={fetchEntries} currentDate={date} />

        <DailySummary
          entries={entries}
          goalCalories={goalCalories}
          caloriesBurned={caloriesBurned}
          goalProtein={effectiveProteinGoal(userProfile)}
          onGoalCaloriesChange={setGoalCalories}
        />

        <DeficitCard
          consumed={totalCalories} burned={caloriesBurned} goalCalories={goalCalories}
          date={date} onBurnedChange={setCaloriesBurned} onGoalChange={setGoalCalories}
        />

        <CalorieHistorySection />

        {/* קישור בולט למעקב משקל + גרפים (במיוחד כשה-bottom nav פחות מורגש) */}
        <a href="/weight"
          className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 shadow-sm hover:shadow-md hover:border-blue-200 active:scale-[0.99] touch-manipulation transition-all">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
            <Scale className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0 text-start">
            <p className="text-sm font-bold text-slate-800">{T.weightCardTitle}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{T.weightCardDesc}</p>
          </div>
          <span className="text-xs font-bold text-blue-600 shrink-0">{T.weightCardCta} →</span>
        </a>

        {/* Meal list */}
        <section className="animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              {lang === "he" ? (isToday ? "מה אכלת היום" : "מה אכלת") : (isToday ? "Today's Log" : "Daily Log")}
              {entries.length > 0 && (
                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full normal-case tracking-normal">
                  {entries.length} {lang === "he" ? "רשומות" : "entries"}
                </span>
              )}
            </h2>
            {entries.length > 0 && (
              <button onClick={handleClearAll} disabled={clearing}
                className="text-xs text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1">
                <Trash2 className="w-3 h-3" />{T.clearAll}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-2.5">
              {[1,2,3].map(i => (
                <div key={i} className="h-20 bg-white rounded-2xl animate-pulse-soft border border-slate-100" style={{ opacity: 1 - i * 0.25 }} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center animate-fade-in">
              <div className="w-20 h-20 mx-auto mb-4 opacity-15">
                <Image src="/logo.png" alt="CF" width={80} height={80} className="rounded-3xl" />
              </div>
              <p className="text-slate-700 font-bold text-base">{isToday ? T.noMeals : T.noMealsHistoryDay}</p>
              <p className="text-slate-400 text-sm mt-1">{isToday ? T.noMealsDesc : T.noMealsHistoryDesc}</p>
            </div>
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

      <footer className="pb-28 sm:pb-8 text-center text-xs text-slate-300 mt-4">{T.poweredBy}</footer>

      {/* ── BOTTOM NAV (mobile) ── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden glass border-t border-slate-100 shadow-lg">
        <div className="flex items-center justify-around px-2 pt-1.5 pb-2 max-w-sm mx-auto pb-safe" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))" }}>
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
    </div>
  );
}
