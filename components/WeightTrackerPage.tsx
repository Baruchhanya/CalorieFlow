"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { ArrowRight, Scale, TrendingDown, TrendingUp, Plus, Trash2, Calendar, Pencil } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";
import type { ChartDay } from "@/app/api/weight-chart/route";

interface WeightEntry { id: string; date: string; weight_kg: number }

function getToday() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}

function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return { y, m: mo, d };
}

function daysInMonth(y: number, month: number) {
  return new Date(y, month, 0).getDate();
}

/** Build ISO date; clamps day to valid day-of-month. */
function toIso(y: number, m: number, d: number): string {
  const dim = daysInMonth(y, m);
  const dd = Math.min(Math.max(1, d), dim);
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function todayParts() {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

const MONTH_NAMES_HE = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"] as const;
const MONTH_NAMES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function formatDayLabel(dateStr: string, lang: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { month: "short", day: "numeric" });
}

// Custom tooltip for weight chart
function WeightTooltip({ active, payload, label, lang }: { active?: boolean; payload?: {value: number}[]; label?: string; lang: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="text-slate-500 text-xs mb-1">{label}</p>
      {payload[0]?.value != null && (
        <p className="font-bold text-emerald-600">{payload[0].value.toFixed(1)} {lang === "he" ? "ק״ג" : "kg"}</p>
      )}
    </div>
  );
}

// Custom tooltip for balance chart
function BalanceTooltip({ active, payload, label, lang }: { active?: boolean; payload?: {value: number}[]; label?: string; lang: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  if (v == null) return null;
  const isDeficit = v < 0;
  const kcal = lang === "he" ? 'קק"ל' : "kcal";
  const defLabel = lang === "he" ? "גרעון" : "Deficit";
  const surLabel = lang === "he" ? "עודף" : "Surplus";
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="text-slate-500 text-xs mb-1">{label}</p>
      <p className={`font-bold ${isDeficit ? "text-emerald-600" : "text-red-500"}`}>
        {isDeficit ? defLabel : surLabel}: {Math.abs(Math.round(v)).toLocaleString()} {kcal}
      </p>
    </div>
  );
}

export function WeightTrackerPage() {
  const router = useRouter();
  const { lang } = useLang();
  const { showToast } = useToast();
  const [chartData, setChartData] = useState<ChartDay[]>([]);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [logDate, setLogDate] = useState(getToday);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const T = lang === "he" ? {
    title: "מעקב משקל",
    subtitle: "עקוב אחר שינויי המשקל שלך לאורך זמן",
    logWeight: "הזן משקל",
    weightLabel: "משקל (ק״ג)",
    save: "שמור",
    saving: "שומר...",
    weightChart: "משקל לאורך זמן",
    balanceChart: "מאזן קלורי יומי",
    deficit: "גרעון",
    surplus: "עודף",
    kg: "ק״ג",
    kcal: 'קק"ל',
    noData: "אין נתונים עדיין",
    noDataDesc: "הזן את המשקל הראשון שלך למעלה",
    current: "נוכחי",
    min: "מינימום",
    max: "מקסימום",
    change: "שינוי",
    history: "היסטוריית שקילות",
    today: "היום",
    avgBalance: "מאזן ממוצע",
    trend: "מגמה",
    trendDown: "ירידה ↓",
    trendUp: "עלייה ↑",
    trendFlat: "יציב ↔",
    placeholder: "75.3",
    deleteConfirm: "למחוק שקילה זו?",
    logDateLabel: "תאריך השקילה",
    onePerDayHint: "משקל אחד לכל יום — שמירה חוזרת באותו תאריך מחליפה את הערך",
    editThisDay: "ערוך יום זה",
    dateDay: "יום",
    dateMonth: "חודש",
    dateYear: "שנה",
    dateOrderHint: "סדר אירופי: יום · חודש · שנה (משמאל לימין)",
    weightSection: "משקל",
    saveWeighIn: "שמור שקילה",
  } : {
    title: "Weight Tracking",
    subtitle: "Track your weight changes over time",
    logWeight: "Log Weight",
    weightLabel: "Weight (kg)",
    save: "Save",
    saving: "Saving...",
    weightChart: "Weight Over Time",
    balanceChart: "Daily Caloric Balance",
    deficit: "Deficit",
    surplus: "Surplus",
    kg: "kg",
    kcal: "kcal",
    noData: "No data yet",
    noDataDesc: "Enter your first weight above",
    current: "Current",
    min: "Min",
    max: "Max",
    change: "Change",
    history: "Weigh-in History",
    today: "Today",
    avgBalance: "Avg. Balance",
    trend: "Trend",
    trendDown: "Losing ↓",
    trendUp: "Gaining ↑",
    trendFlat: "Stable ↔",
    placeholder: "75.3",
    deleteConfirm: "Delete this weigh-in?",
    logDateLabel: "Weigh-in date",
    onePerDayHint: "One weight per day — saving again for the same date replaces it",
    editThisDay: "Edit this day",
    dateDay: "Day",
    dateMonth: "Month",
    dateYear: "Year",
    dateOrderHint: "European order: day · month · year (left to right)",
    weightSection: "Weight",
    saveWeighIn: "Save weigh-in",
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [chartRes, entriesRes] = await Promise.all([
        fetch("/api/weight-chart", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/weight", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setChartData(chartRes.days ?? []);
      setEntries(Array.isArray(entriesRes) ? entriesRes : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* מילוי/ניקוי לפי תאריך: אם יש רשומה ליום — מציגים אותה; אם כבר יש נתונים בשרת אבל לא ליום הזה — שדה ריק; לא מאפסים כש-entries עדיין [] לפני טעינה ראשונה */
  useEffect(() => {
    const ex = entries.find((e) => e.date === logDate);
    if (ex) {
      setWeightInput(String(Number(ex.weight_kg).toFixed(1)));
    } else if (entries.length > 0) {
      setWeightInput("");
    }
  }, [logDate, entries]);

  const handleSave = async () => {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val < 20 || val > 300) return;
    setSaving(true);
    try {
      await fetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight_kg: val, date: logDate }),
      });
      await fetchData();
      const dLabel = formatDayLabel(logDate, lang);
      showToast(
        lang === "he" ? `נשמר: ${dLabel}` : `Saved: ${dLabel}`,
        "success"
      );
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(T.deleteConfirm)) return;
    setDeleting(id);
    await fetch(`/api/weight?id=${id}`, { method: "DELETE" });
    await fetchData();
    setDeleting(null);
    showToast(lang === "he" ? "השקילה נמחקה" : "Weigh-in removed", "info");
  };

  // Stats
  const weights = entries.map(e => e.weight_kg);
  const currentWeight = weights.at(-1) ?? null;
  const minWeight = weights.length ? Math.min(...weights) : null;
  const maxWeight = weights.length ? Math.max(...weights) : null;
  const firstWeight = weights.at(0) ?? null;
  const totalChange = currentWeight != null && firstWeight != null ? currentWeight - firstWeight : null;

  // Trend (last 7 entries)
  const recent = weights.slice(-7);
  const trend = recent.length >= 2
    ? recent.at(-1)! - recent.at(0)!
    : 0;
  const trendLabel = Math.abs(trend) < 0.3 ? T.trendFlat : trend < 0 ? T.trendDown : T.trendUp;

  // Balance stats
  const balanceDays = chartData.filter(d => d.balance != null);
  const avgBalance = balanceDays.length
    ? Math.round(balanceDays.reduce((s, d) => s + d.balance!, 0) / balanceDays.length)
    : null;

  // Y-axis domain for weight (tight zoom)
  const weightValues = chartData.filter(d => d.weight_kg != null).map(d => d.weight_kg!);
  const weightMin = weightValues.length ? Math.floor(Math.min(...weightValues) - 1) : 50;
  const weightMax = weightValues.length ? Math.ceil(Math.max(...weightValues) + 1) : 100;

  const hasWeightData = entries.length > 0;
  const hasChartData = chartData.length > 0;

  const tp = todayParts();
  const dm = parseIsoDate(logDate) ?? parseIsoDate(getToday())!;
  const monthNames = lang === "he" ? MONTH_NAMES_HE : MONTH_NAMES_EN;
  const yMin = Math.min(tp.y - 15, dm.y);
  const years: number[] = [];
  for (let y = tp.y; y >= yMin; y--) years.push(y);

  const maxMonthForYear = (y: number) => (y < tp.y ? 12 : tp.m);
  const maxDayForMonth = (y: number, m: number) => {
    const dim = daysInMonth(y, m);
    if (y < tp.y || (y === tp.y && m < tp.m)) return dim;
    if (y === tp.y && m === tp.m) return Math.min(dim, tp.d);
    return 1;
  };

  const setDateFromParts = (y: number, m: number, d: number) => {
    const yClamped = Math.min(y, tp.y);
    const mMax = maxMonthForYear(yClamped);
    const mClamped = Math.min(Math.max(1, m), mMax);
    const dMax = maxDayForMonth(yClamped, mClamped);
    const dClamped = Math.min(Math.max(1, d), dMax);
    const iso = toIso(yClamped, mClamped, dClamped);
    const t = getToday();
    setLogDate(iso > t ? t : iso);
  };

  const maxDayCurrent = maxDayForMonth(dm.y, dm.m);
  const monthOptions = Array.from({ length: maxMonthForYear(dm.y) }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push("/")}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <Image src="/logo.png" alt="CalorieFlow" width={36} height={36} className="rounded-xl shadow-sm shrink-0" />
          <div>
            <h1 className="text-xl font-black text-white leading-tight">{T.title}</h1>
            <p className="text-blue-100 text-xs">{T.subtitle}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-5 pb-12">
        {/* Input card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-6">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-500 shrink-0" />
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{T.logWeight}</h2>
          </div>

          {/* Date: native selects = always correct DD / MM / YYYY order, no RTL quirks */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              {T.logDateLabel}
            </label>
            <div
              dir="ltr"
              className="rounded-2xl border-2 border-slate-200 bg-slate-50/50 p-3 sm:p-4 transition-colors focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-200/60"
              style={{ unicodeBidi: "isolate" }}
            >
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="min-w-0">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {T.dateDay}
                  </span>
                  <select
                    aria-label={T.dateDay}
                    value={dm.d}
                    onChange={(e) => setDateFromParts(dm.y, dm.m, Number(e.target.value))}
                    className="h-11 w-full min-w-0 cursor-pointer rounded-xl border border-slate-200 bg-white px-2 text-center text-base font-bold tabular-nums text-slate-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    {Array.from({ length: maxDayCurrent }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {String(d).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {T.dateMonth}
                  </span>
                  <select
                    aria-label={T.dateMonth}
                    value={dm.m}
                    onChange={(e) => setDateFromParts(dm.y, Number(e.target.value), dm.d)}
                    className="h-11 w-full min-w-0 cursor-pointer rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-semibold text-slate-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:text-base"
                  >
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, "0")} — {monthNames[m - 1]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {T.dateYear}
                  </span>
                  <select
                    aria-label={T.dateYear}
                    value={dm.y}
                    onChange={(e) => setDateFromParts(Number(e.target.value), dm.m, dm.d)}
                    className="h-11 w-full min-w-0 cursor-pointer rounded-xl border border-slate-200 bg-white px-2 text-center text-base font-bold tabular-nums text-slate-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-2 text-center text-xs font-medium tabular-nums text-slate-500">
                {String(dm.d).padStart(2, "0")}/{String(dm.m).padStart(2, "0")}/{dm.y}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <span className="text-slate-500">{T.dateOrderHint}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span>{T.onePerDayHint}</span>
            </p>
          </div>

          {/* Weight + save: numeric LTR island; full-width CTA */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
              {T.weightSection}
            </label>
            <div
              dir="ltr"
              className="flex min-h-[3.5rem] items-stretch rounded-2xl border-2 border-slate-200 bg-slate-50/40 overflow-hidden transition-colors focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-200/60"
              style={{ unicodeBidi: "isolate" }}
            >
              <input
                type="number"
                step="0.1"
                min="20"
                max="300"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder={T.placeholder}
                className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-2xl font-black tabular-nums text-blue-600 placeholder:text-slate-300 focus:outline-none focus:ring-0 text-start"
              />
              <span className="flex shrink-0 items-center border-s-2 border-slate-200 bg-slate-100/80 px-4 text-sm font-bold text-slate-500">
                {T.kg}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !weightInput}
              dir="ltr"
              className="w-full min-h-[3.25rem] rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 py-3.5 text-base font-bold text-white shadow-md transition-all hover:opacity-95 active:scale-[0.99] touch-manipulation disabled:opacity-40 disabled:active:scale-100 flex flex-row items-center justify-center gap-2"
            >
              {saving ? <Scale className="w-5 h-5 shrink-0 animate-pulse" /> : <Plus className="w-5 h-5 shrink-0" />}
              <span className="text-center" dir="auto">
                {saving ? T.saving : T.saveWeighIn}
              </span>
            </button>
          </div>
        </div>

        {/* Stats row */}
        {hasWeightData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: T.current, value: currentWeight?.toFixed(1) ?? "–", unit: T.kg, color: "text-blue-600", bg: "bg-blue-50", icon: <Scale className="w-4 h-4" /> },
              { label: T.change, value: totalChange != null ? `${totalChange > 0 ? "+" : ""}${totalChange.toFixed(1)}` : "–", unit: T.kg, color: totalChange! < 0 ? "text-emerald-600" : "text-red-500", bg: totalChange! < 0 ? "bg-emerald-50" : "bg-red-50", icon: totalChange! < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" /> },
              { label: T.min, value: minWeight?.toFixed(1) ?? "–", unit: T.kg, color: "text-emerald-600", bg: "bg-emerald-50", icon: <TrendingDown className="w-4 h-4" /> },
              { label: T.max, value: maxWeight?.toFixed(1) ?? "–", unit: T.kg, color: "text-slate-700", bg: "bg-slate-50", icon: <TrendingUp className="w-4 h-4" /> },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className={`w-8 h-8 rounded-xl ${s.bg} ${s.color} flex items-center justify-center mb-2`}>{s.icon}</div>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}<span className="text-sm font-normal text-slate-400 ms-1">{s.unit}</span></p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts */}
        {hasChartData ? (
          <div className="flex flex-col gap-4">
            {/* Weight chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{T.weightChart}</h3>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${Math.abs(trend) < 0.3 ? "bg-slate-100 text-slate-600" : trend < 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                  {trendLabel}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[weightMin, weightMax]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={v => `${v}`} width={35} />
                  <Tooltip content={<WeightTooltip lang={lang} />} />
                  <Area
                    type="monotone" dataKey="weight_kg" stroke="#3b82f6" strokeWidth={2.5}
                    fill="url(#weightGrad)" dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#3b82f6" }} connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Balance chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{T.balanceChart}</h3>
                {avgBalance !== null && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${avgBalance < 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                    {T.avgBalance}: {avgBalance > 0 ? "+" : ""}{avgBalance.toLocaleString()} {T.kcal}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mb-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> {T.deficit}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> {T.surplus}</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={v => v === 0 ? "0" : `${v > 0 ? "+" : ""}${Math.round(v/100)*100}`} width={40} />
                  <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
                  <Tooltip content={<BalanceTooltip lang={lang} />} />
                  <Bar dataKey="balance" radius={[3, 3, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.balance == null ? "transparent" : d.balance < 0 ? "#34d399" : "#f87171"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">טוען נתונים...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Scale className="w-8 h-8 text-blue-300" />
            </div>
            <p className="text-slate-600 font-bold">{T.noData}</p>
            <p className="text-slate-400 text-sm mt-1">{T.noDataDesc}</p>
          </div>
        )}

        {/* Weigh-in history log */}
        {entries.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{T.history}</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {[...entries].reverse().slice(0, 20).map((e) => {
                const idx = entries.findIndex(x => x.id === e.id);
                const prev = idx > 0 ? entries[idx - 1].weight_kg : null;
                const diff = prev != null ? e.weight_kg - prev : null;
                const isToday = e.date === getToday();
                return (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="text-xs text-slate-400 w-20 shrink-0">
                      {formatDayLabel(e.date, lang)}
                      {isToday && <span className="ms-1 text-blue-500 font-bold">·{lang === "he" ? "היום" : "today"}</span>}
                    </div>
                    <p className="flex-1 font-black text-slate-800">{Number(e.weight_kg).toFixed(1)}<span className="text-xs text-slate-400 font-normal ms-1">{T.kg}</span></p>
                    {diff != null && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Math.abs(diff) < 0.05 ? "bg-slate-100 text-slate-500" : diff < 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-500"}`}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                      </span>
                    )}
                    <button type="button" title={T.editThisDay}
                      onClick={() => { setLogDate(e.date); setWeightInput(String(Number(e.weight_kg).toFixed(1))); }}
                      className="p-1.5 rounded-xl hover:bg-blue-50 text-slate-300 hover:text-blue-500 transition-colors touch-manipulation">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => handleDelete(e.id)} disabled={deleting === e.id}
                      className="p-1.5 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors touch-manipulation">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
