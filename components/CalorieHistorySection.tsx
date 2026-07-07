"use client";

import { useState, useEffect, useCallback, memo } from "react";
import Link from "next/link";
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

  const d = new Date(day.date + "T12:00:00");
  const label = d.toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { weekday: "short" });
  const dateLabel = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

  const absVal = Math.abs(day.balance);
  const sign = day.balance > 0 ? "+" : day.balance < 0 ? "−" : "";

  return (
    <Link
      href={`/?date=${day.date}`}
      className="flex flex-col items-center gap-1 flex-1 min-w-0 transition-transform active:scale-95 hover:bg-canvas rounded-xl p-1 -m-1"
      title={lang === "he" ? "לחץ לפירוט" : "Click for details"}
    >
      {/* Value label above bar */}
      <span
        className={`text-[9px] font-bold leading-none tabular-nums ${
          day.estimated
            ? "text-ink-3"
            : isDeficit
            ? "text-good"
            : "text-over"
        }`}
      >
        {sign}{absVal >= 1000 ? `${Math.round(absVal / 100) / 10}k` : absVal}
      </span>

      {/* Bar container — fixed height, bar grows from bottom */}
      <div className="relative w-full flex items-end justify-center" style={{ height: 84 }}>
        <div
          className={`w-full max-w-[28px] rounded-t-md transition-all duration-500 ${
            day.estimated
              ? "bg-line"
              : isDeficit
              ? "bg-good"
              : "bg-over"
          }`}
          style={{
            height: barH,
            ...(day.estimated ? { border: "1px dashed var(--color-ink-3)", borderBottom: "none" } : {}),
          }}
        />
      </div>

      {/* Day label + date */}
      <span className={`text-[10px] font-semibold leading-none truncate w-full text-center ${day.estimated ? "text-ink-3" : "text-ink-2"}`}>
        {label}
      </span>
      <span className="text-[9px] text-ink-3 leading-none truncate w-full text-center tabular-nums">
        {dateLabel}
      </span>
    </Link>
  );
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

function formatVal(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = Math.abs(n);
  return { sign, abs };
}

function StatTile({
  label,
  avg,
  total,
  hint,
  totalLabel,
}: {
  label: string;
  avg: number | null;
  total: number | null;
  hint: string;
  totalLabel: string;
}) {
  const { T } = useLang();

  if (avg === null) {
    return (
      <div className="flex-1 bg-canvas border border-line rounded-xl p-3.5 flex flex-col gap-1">
        <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-ink-3/50">—</p>
        <p className="text-[10px] text-ink-3/70">{hint}</p>
      </div>
    );
  }

  const isDeficit = avg <= 0;
  const avgFmt = formatVal(avg);
  const totalFmt = total !== null ? formatVal(total) : null;

  return (
    <div
      className={`flex-1 rounded-xl p-3.5 flex flex-col gap-1.5 border ${
        isDeficit ? "bg-brand-50 border-brand-100" : "bg-over/8 border-over/15"
      }`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${isDeficit ? "text-brand-600" : "text-over"}`}>
        {label}
      </p>

      {/* Average */}
      <div className="flex items-end gap-1">
        <span className={`text-2xl font-bold tabular-nums leading-none ${isDeficit ? "text-brand-700" : "text-over"}`}>
          {avgFmt.sign}{avgFmt.abs.toLocaleString()}
        </span>
        <span className="text-xs text-ink-3 mb-0.5">{T.kcal}</span>
      </div>

      {/* Total */}
      {totalFmt && (
        <div className={`flex items-center gap-1 pt-1 border-t ${isDeficit ? "border-brand-100" : "border-over/15"}`}>
          <span className={`text-[10px] font-semibold ${isDeficit ? "text-brand-600" : "text-over"}`}>
            {totalLabel}:
          </span>
          <span className={`text-[10px] font-bold tabular-nums ${isDeficit ? "text-brand-700" : "text-over"}`}>
            {totalFmt.sign}{totalFmt.abs.toLocaleString()} {T.kcal}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1">
        {isDeficit ? (
          <TrendingDown className="w-3 h-3 text-brand-500 shrink-0" />
        ) : (
          <TrendingUp className="w-3 h-3 text-over shrink-0" />
        )}
        <p className={`text-[10px] font-medium ${isDeficit ? "text-brand-600" : "text-over"}`}>
          {hint}
        </p>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="bg-surface rounded-(--radius-card) shadow-(--shadow-card) border border-line overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-line flex items-center gap-2">
        <div className="h-3 w-36 bg-line/60 rounded-full animate-pulse" />
      </div>
      <div className="p-5 flex flex-col gap-4">
        {/* Chart skeleton */}
        <div className="flex items-end gap-2 h-24 px-1">
          {[60, 40, 75, 30, 55, 80, 45].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-line/60 rounded-t-md animate-pulse"
              style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
        {/* Stat tiles skeleton */}
        <div className="flex gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex-1 h-20 bg-line/60 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default memo(function CalorieHistorySection({ initialData }: { initialData?: BalanceHistoryResponse }) {
  const { T, lang } = useLang();
  const [data, setData] = useState<BalanceHistoryResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(false);

  // Parent supplies balance data via initialData (from /api/init phase=secondary).
  // Track it here and clear the skeleton once it arrives. The component no longer
  // self-fetches on mount — that would duplicate the secondary request.
  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
    }
  }, [initialData]);

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

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="bg-surface rounded-(--radius-card) shadow-(--shadow-card) border border-line p-6 flex flex-col items-center gap-3">
        <BarChart2 className="w-8 h-8 text-ink-3/40" />
        <p className="text-sm text-ink-3 text-center">
          {lang === "he" ? "שגיאה בטעינת נתוני המאזן" : "Failed to load balance data"}
        </p>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-brand-600 font-semibold hover:underline"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {lang === "he" ? "נסה שוב" : "Retry"}
        </button>
      </div>
    );
  }

  const chartDays = data?.chart_days ?? data?.days7 ?? []; // fallback to days7 for old API responses
  const hasData = chartDays.length > 0;
  const hasEstimated = chartDays.some((d) => d.estimated);

  if (!hasData) {
    return (
      <div className="bg-surface rounded-(--radius-card) shadow-(--shadow-card) border border-line p-6 flex flex-col items-center gap-3 text-center">
        <BarChart2 className="w-10 h-10 text-ink-3/30" />
        <div>
          <p className="text-sm font-semibold text-ink-2">{T.balanceHistory}</p>
          <p className="text-xs text-ink-3 mt-1">{T.noBalanceData}</p>
        </div>
      </div>
    );
  }

  const maxAbs = Math.max(...chartDays.map((d) => Math.abs(d.balance)), 1);

  return (
    <div className="bg-surface rounded-(--radius-card) shadow-(--shadow-card) border border-line overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-line flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest">
            {T.balanceHistory}
          </p>
          <p className="text-[11px] text-ink-3 mt-0.5">{T.balanceHistoryHint}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-good">
            <span className="w-2.5 h-2.5 rounded-sm bg-good inline-block" />
            {lang === "he" ? "גרעון" : "Deficit"}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-over">
            <span className="w-2.5 h-2.5 rounded-sm bg-over inline-block" />
            {lang === "he" ? "עודף" : "Surplus"}
          </span>
          {hasEstimated && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-ink-3">
              <span className="w-2.5 h-2.5 rounded-sm bg-line inline-block border border-dashed border-ink-3" />
              {T.estimatedLegend}
            </span>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Bar chart */}
        <div className="flex items-end gap-1.5 sm:gap-2 px-0.5">
          {chartDays.map((day) => (
            <BalanceBar key={day.date} day={day} maxAbs={maxAbs} lang={lang} />
          ))}
        </div>

        {/* Stat tiles — based on days7 (tracked-only) */}
        <div className="flex gap-3">
          <StatTile
            label={T.weeklyAvg}
            avg={data?.weekly_avg ?? null}
            total={data?.weekly_total ?? null}
            totalLabel={T.weeklyTotal}
            hint={T.balanceHistoryHint}
          />
          <StatTile
            label={T.monthlyAvg}
            avg={data?.monthly_avg ?? null}
            total={data?.monthly_total ?? null}
            totalLabel={T.monthlyTotal}
            hint={lang === "he" ? "30 הימים האחרונים" : "Last 30 days"}
          />
        </div>
      </div>
    </div>
  );
});
