"use client";

import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import type { WeightWeek } from "@/lib/weight";
import type { ChartDay } from "@/app/api/weight-chart/route";

export const CHART_DAY_WIDTH = 44;
export const CHART_WEEK_WIDTH = 64;

function formatDayLabel(dateStr: string, lang: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { month: "short", day: "numeric" });
}

function WeightTooltip({ active, payload, lang }: { active?: boolean; payload?: { value: number; payload?: WeightWeek }[]; lang: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const startLabel = point?.weekStart ? formatDayLabel(point.weekStart, lang) : "";
  const endLabel = point?.weekEnd ? formatDayLabel(point.weekEnd, lang) : "";
  const rangeLabel = startLabel && endLabel ? `${startLabel} – ${endLabel}` : "";
  const countLabel = point?.count
    ? (lang === "he" ? `${point.count} שקילות` : `${point.count} weigh-ins`)
    : "";
  return (
    <div className="bg-surface border border-line rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="text-ink-2 text-xs mb-1">{rangeLabel}</p>
      {payload[0]?.value != null && (
        <p className="font-bold text-brand-600 tabular-nums">{payload[0].value.toFixed(1)} {lang === "he" ? "ק״ג" : "kg"}</p>
      )}
      {countLabel && <p className="text-[10px] text-ink-3 mt-0.5">{countLabel}</p>}
    </div>
  );
}

function BalanceTooltip({ active, payload, lang }: { active?: boolean; payload?: { value: number; payload?: ChartDay }[]; lang: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  if (v == null) return null;
  const point = payload[0]?.payload;
  const dateLabel = point?.date ? formatDayLabel(point.date, lang) : "";
  const isDeficit = v < 0;
  const kcal = lang === "he" ? 'קק"ל' : "kcal";
  const defLabel = lang === "he" ? "גרעון" : "Deficit";
  const surLabel = lang === "he" ? "עודף" : "Surplus";
  return (
    <div className="bg-surface border border-line rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="text-ink-2 text-xs mb-1">{dateLabel}</p>
      <p className={`font-bold tabular-nums ${isDeficit ? "text-good" : "text-over"}`}>
        {isDeficit ? defLabel : surLabel}: {Math.abs(Math.round(v)).toLocaleString()} {kcal}
      </p>
    </div>
  );
}

export function WeightAreaChart({ width, data, yMin, yMax, lang }: {
  width: number; data: WeightWeek[]; yMin: number; yMax: number; lang: string;
}) {
  return (
    <AreaChart width={width} height={200} data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
      <defs>
        <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="var(--color-brand-500)" stopOpacity={0.15} />
          <stop offset="95%" stopColor="var(--color-brand-500)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-ink-3)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={CHART_WEEK_WIDTH - 8} />
      <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10, fill: "var(--color-ink-3)" }} tickLine={false} axisLine={false} tickFormatter={v => `${v}`} width={35} />
      <Tooltip content={<WeightTooltip lang={lang} />} />
      <Area
        type="monotone" dataKey="avg_kg" stroke="var(--color-brand-500)" strokeWidth={2.5}
        fill="url(#weightGrad)" dot={{ r: 3, fill: "var(--color-brand-500)", strokeWidth: 0 }}
        activeDot={{ r: 5, fill: "var(--color-brand-500)" }} connectNulls
      />
    </AreaChart>
  );
}

export function BalanceBarChart({ width, data, lang }: {
  width: number; data: ChartDay[]; lang: string;
}) {
  return (
    <BarChart width={width} height={180} data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-ink-3)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={CHART_DAY_WIDTH - 8} />
      <YAxis tick={{ fontSize: 10, fill: "var(--color-ink-3)" }} tickLine={false} axisLine={false} tickFormatter={v => v === 0 ? "0" : `${v > 0 ? "+" : ""}${Math.round(v/100)*100}`} width={40} />
      <ReferenceLine y={0} stroke="var(--color-ink-3)" strokeOpacity={0.4} strokeWidth={1.5} />
      <Tooltip content={<BalanceTooltip lang={lang} />} />
      <Bar dataKey="balance" radius={[3, 3, 0, 0]}>
        {data.map((d, i) => (
          <Cell key={i} fill={d.balance == null ? "transparent" : d.balance < 0 ? "var(--color-good)" : "var(--color-over)"} />
        ))}
      </Bar>
    </BarChart>
  );
}
