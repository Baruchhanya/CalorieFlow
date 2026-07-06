"use client";

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { getToday } from "@/lib/dates";
import { getWeekSummary, type WeightEntry, type WeekSummary } from "@/lib/weight";

export default function WeeklyWeightCard() {
  const { lang } = useLang();
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/weight", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((entries: WeightEntry[] | null) => {
        if (cancelled) return;
        setSummary(getWeekSummary(Array.isArray(entries) ? entries : [], getToday()));
      })
      .catch(() => {
        if (!cancelled) setSummary(getWeekSummary([], getToday()));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const kg = lang === "he" ? "ק״ג" : "kg";
  const title = lang === "he" ? "ממוצע משקל שבועי" : "Weekly weight average";
  const openLabel = lang === "he" ? "פתח מעקב" : "Open tracker";

  if (loading) {
    return (
      <a href="/weight"
        className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-4 shadow-sm animate-pulse-soft">
        <div className="w-11 h-11 rounded-xl bg-white shadow-sm shrink-0" />
        <div className="flex-1">
          <div className="h-3 w-32 bg-slate-200/60 rounded mb-2" />
          <div className="h-5 w-24 bg-slate-200/60 rounded" />
        </div>
      </a>
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
    <a href="/weight"
      className="block rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-indigo-50 to-white px-4 py-4 shadow-sm hover:shadow-md hover:border-blue-200 active:scale-[0.99] touch-manipulation transition-all">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
          <Scale className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0 text-start">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
            {delta != null && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  Math.abs(delta) < 0.05
                    ? "bg-slate-100 text-slate-600"
                    : delta < 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {delta > 0 ? "+" : ""}{delta.toFixed(1)} {kg}
              </span>
            )}
          </div>
          <p className="text-2xl font-black text-blue-600 tabular-nums leading-tight mt-0.5">
            {thisWeek ? thisWeek.avg_kg.toFixed(1) : "–"}
            <span className="text-sm font-semibold text-slate-400 ms-1">{kg}</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            <span className="tabular-nums font-semibold text-slate-600">{rangeLabel}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span>{countLabel}</span>
          </p>
        </div>
        <span className="text-xs font-bold text-blue-600 shrink-0">{openLabel} →</span>
      </div>
    </a>
  );
}
