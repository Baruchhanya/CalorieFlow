"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { getToday } from "@/lib/dates";
import { getWeekSummary, type WeightEntry } from "@/lib/weight";

export default function WeeklyWeightCard({ entries }: { entries?: WeightEntry[] }) {
  const { lang } = useLang();
  const loading = entries === undefined;
  const summary = useMemo(
    () => (entries === undefined ? null : getWeekSummary(entries, getToday())),
    [entries]
  );

  const kg = lang === "he" ? "ק״ג" : "kg";
  const title = lang === "he" ? "ממוצע משקל שבועי" : "Weekly weight average";
  const openLabel = lang === "he" ? "פתח מעקב" : "Open tracker";

  if (loading) {
    return (
      <Link href="/weight"
        className="flex items-center gap-3 rounded-(--radius-card) border border-line bg-surface px-4 py-4 shadow-(--shadow-card) animate-pulse-soft">
        <div className="w-11 h-11 rounded-xl bg-canvas shrink-0" />
        <div className="flex-1">
          <div className="h-3 w-32 bg-line/60 rounded mb-2" />
          <div className="h-5 w-24 bg-line/60 rounded" />
        </div>
      </Link>
    );
  }

  const thisWeek = summary?.thisWeek;
  const delta = summary?.delta;
  const rangeLabel = summary?.currentRangeLabel ?? "";
  const countLabel = thisWeek
    ? (lang === "he"
        ? `${thisWeek.count} ${thisWeek.count === 1 ? "שקילה" : "שקילות"}`
        : `${thisWeek.count} weigh-in${thisWeek.count === 1 ? "" : "s"}`)
    : (lang === "he" ? "אין שקילות השבוע" : "no weigh-ins yet");

  return (
    <Link href="/weight"
      className="block rounded-(--radius-card) border border-line bg-surface px-4 py-4 shadow-(--shadow-card) hover:shadow-md active:scale-[0.99] touch-manipulation transition-all">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <Scale className="w-5 h-5 text-brand-600" />
        </div>
        <div className="flex-1 min-w-0 text-start">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest">{title}</p>
            {delta != null && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                  Math.abs(delta) < 0.05
                    ? "bg-canvas text-ink-2 border border-line"
                    : delta < 0
                    ? "bg-brand-50 text-brand-700"
                    : "bg-over/10 text-over"
                }`}
              >
                {delta > 0 ? "+" : ""}{delta.toFixed(1)} {kg}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-ink tabular-nums leading-tight mt-0.5">
            {thisWeek ? thisWeek.avg_kg.toFixed(1) : "–"}
            <span className="text-sm font-semibold text-ink-3 ms-1">{kg}</span>
          </p>
          <p className="text-[11px] text-ink-2 mt-0.5">
            <span className="tabular-nums font-semibold text-ink-2">{rangeLabel}</span>
            <span className="mx-1.5 text-ink-3/50">·</span>
            <span>{countLabel}</span>
          </p>
        </div>
        <span className="text-xs font-bold text-brand-600 shrink-0">{openLabel} →</span>
      </div>
    </Link>
  );
}
