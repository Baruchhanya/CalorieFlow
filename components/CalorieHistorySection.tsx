"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingDown, TrendingUp, RefreshCw, BarChart2 } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import type { BalanceHistoryResponse, BalanceDay } from "@/app/api/balance-history/route";

// ─── Tiny bar chart ──────────────────────────────────────────────────────────

function BalanceBar({
  day,
  maxAbs,
  lang,
}: {
  day: BalanceDay;
  maxAbs: number;
  lang: string;
}) {
  const isDeficit = day.balance <= 0;
  const pct = maxAbs > 0 ? Math.abs(day.balance) / maxAbs : 0;
  const barH = Math.max(Math.round(pct * 80), 4); // 4–80px

  const label = new Date(day.date + "T12:00:00").toLocaleDateString(
    lang === "he" ? "he-IL" : "en-US",
    { weekday: "short" }
  );

  const absVal = Math.abs(day.balance);
  const sign = day.balance > 0 ? "+" : day.balance < 0 ? "−" : "";

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      {/* Value label above bar */}
      <span
        className={`text-[9px] font-bold leading-none ${
          isDeficit ? "text-emerald-600" : "text-red-500"
        }`}
      >
        {sign}{absVal >= 1000 ? `${Math.round(absVal / 100) / 10}k` : absVal}
      </span>

      {/* Bar container — fixed height, bar grows from bottom */}
      <div className="relative w-full flex items-end justify-center" style={{ height: 84 }}>
        <div
          className={`w-full max-w-[28px] rounded-t-md transition-all duration-500 ${
            isDeficit
              ? "bg-gradient-to-t from-emerald-500 to-emerald-400"
              : "bg-gradient-to-t from-red-500 to-red-400"
          }`}
          style={{ height: barH }}
        />
      </div>

      {/* Day label */}
      <span className="text-[10px] text-slate-400 font-medium leading-none truncate w-full text-center">
        {label}
      </span>
    </div>
  );
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint: string;
}) {
  const { T } = useLang();

  if (value === null) {
    return (
      <div className="flex-1 bg-slate-50 rounded-2xl p-3.5 flex flex-col gap-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-black text-slate-300">—</p>
        <p className="text-[10px] text-slate-300">{hint}</p>
      </div>
    );
  }

  const isDeficit = value <= 0;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);

  return (
    <div
      className={`flex-1 rounded-2xl p-3.5 flex flex-col gap-1 border ${
        isDeficit
          ? "bg-emerald-50 border-emerald-100"
          : "bg-red-50 border-red-100"
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-wide ${
          isDeficit ? "text-emerald-600" : "text-red-500"
        }`}
      >
        {label}
      </p>
      <div className="flex items-end gap-1">
        <span
          className={`text-2xl font-black leading-none ${
            isDeficit ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {sign}{abs.toLocaleString()}
        </span>
        <span className="text-xs text-slate-400 mb-0.5">{T.kcal}</span>
      </div>
      <div className="flex items-center gap-1">
        {isDeficit ? (
          <TrendingDown className="w-3 h-3 text-emerald-500 shrink-0" />
        ) : (
          <TrendingUp className="w-3 h-3 text-red-400 shrink-0" />
        )}
        <p className={`text-[10px] font-medium ${isDeficit ? "text-emerald-600" : "text-red-400"}`}>
          {hint}
        </p>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-slate-50 flex items-center gap-2">
        <div className="h-3 w-36 bg-slate-100 rounded-full animate-pulse" />
      </div>
      <div className="p-5 flex flex-col gap-4">
        {/* Chart skeleton */}
        <div className="flex items-end gap-2 h-24 px-1">
          {[60, 40, 75, 30, 55, 80, 45].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-slate-100 rounded-t-md animate-pulse"
              style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
        {/* Stat tiles skeleton */}
        <div className="flex gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex-1 h-20 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalorieHistorySection() {
  const { T, lang } = useLang();
  const [data, setData] = useState<BalanceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/balance-history");
      if (!res.ok) throw new Error("fetch failed");
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col items-center gap-3">
        <BarChart2 className="w-8 h-8 text-slate-300" />
        <p className="text-sm text-slate-400 text-center">
          {lang === "he" ? "שגיאה בטעינת נתוני המאזן" : "Failed to load balance data"}
        </p>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold hover:underline"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {lang === "he" ? "נסה שוב" : "Retry"}
        </button>
      </div>
    );
  }

  const days7 = data?.days7 ?? [];
  const hasData = days7.length > 0;

  if (!hasData) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col items-center gap-3 text-center">
        <BarChart2 className="w-10 h-10 text-slate-200" />
        <div>
          <p className="text-sm font-semibold text-slate-500">{T.balanceHistory}</p>
          <p className="text-xs text-slate-400 mt-1">{T.noBalanceData}</p>
        </div>
      </div>
    );
  }

  const maxAbs = Math.max(...days7.map((d) => Math.abs(d.balance)), 1);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-slate-50 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {T.balanceHistory}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">{T.balanceHistoryHint}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
            {lang === "he" ? "גרעון" : "Deficit"}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />
            {lang === "he" ? "עודף" : "Surplus"}
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Bar chart */}
        <div className="flex items-end gap-1.5 sm:gap-2 px-0.5">
          {days7.map((day) => (
            <BalanceBar key={day.date} day={day} maxAbs={maxAbs} lang={lang} />
          ))}
        </div>

        {/* Stat tiles */}
        <div className="flex gap-3">
          <StatTile
            label={T.weeklyAvg}
            value={data?.weekly_avg ?? null}
            hint={T.balanceHistoryHint}
          />
          <StatTile
            label={T.monthlyAvg}
            value={data?.monthly_avg ?? null}
            hint={lang === "he" ? "30 הימים האחרונים" : "Last 30 days"}
          />
        </div>
      </div>
    </div>
  );
}
