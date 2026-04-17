"use client";

import { MealEntry, DEFAULT_TARGETS } from "@/types";
import { useLang } from "@/lib/i18n/context";

interface DailySummaryProps {
  entries: MealEntry[];
  goalCalories?: number;
  goalProtein?: number;
}

function MacroBar({ label, value, target, unit, gradient, bg }: {
  label: string; value: number; target: number; unit: string; gradient: string; bg: string;
}) {
  const pct = Math.min((value / target) * 100, 100);
  const over = value > target;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <span className={`text-xs font-bold ${over ? "text-red-500" : "text-slate-700"}`}>
          {Math.round(value)}<span className="text-slate-400 font-normal">/{target}{unit}</span>
        </span>
      </div>
      <div className={`h-2 rounded-full ${bg} overflow-hidden`}>
        <div className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const { T } = useLang();
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(consumed / target, 1);
  const offset = circumference * (1 - pct);
  const over = consumed > target;
  const remaining = Math.max(target - consumed, 0);
  const percentage = Math.round((consumed / target) * 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-40 h-40">
        {/* Background glow */}
        <div className={`absolute inset-4 rounded-full blur-lg opacity-20 ${over ? "bg-red-400" : "bg-emerald-400"}`} />
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="10" />
          <circle
            cx="64" cy="64" r={radius} fill="none"
            stroke={over ? "#ef4444" : "url(#ringGrad)"}
            strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-black leading-none ${over ? "text-red-500" : "text-slate-800"}`}>
            {Math.round(consumed)}
          </span>
          <span className="text-xs text-slate-400 mt-0.5">{T.kcal}</span>
          <span className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full ${over ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
            {percentage}%
          </span>
        </div>
      </div>
      <p className="text-sm text-center text-slate-500">
        {over ? (
          <span className="text-red-500 font-semibold">+{Math.round(consumed - target)} {T.kcal} {T.exceededBy.includes("ב") ? "" : "over"}</span>
        ) : (
          <>{T.remaining}: <span className="font-bold text-emerald-600">{Math.round(remaining)}</span> {T.kcal}</>
        )}
      </p>
    </div>
  );
}

export default function DailySummary({ entries, goalCalories, goalProtein }: DailySummaryProps) {
  const { T } = useLang();
  const target = goalCalories ?? DEFAULT_TARGETS.calories;
  const totals = entries.reduce(
    (acc, e) => ({ calories: acc.calories + e.calories, protein: acc.protein + e.protein, carbs: acc.carbs + e.carbs, fat: acc.fat + e.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{T.dailySummary}</h2>
      </div>
      <div className="p-5">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <CalorieRing consumed={totals.calories} target={target} />
          <div className="flex-1 w-full flex flex-col gap-4">
            <MacroBar label={T.protein} value={totals.protein} target={goalProtein ?? DEFAULT_TARGETS.protein} unit="g" gradient="from-blue-400 to-indigo-500" bg="bg-blue-50" />
            <MacroBar label={T.carbs} value={totals.carbs} target={DEFAULT_TARGETS.carbs} unit="g" gradient="from-violet-400 to-purple-500" bg="bg-violet-50" />
            <MacroBar label={T.fat} value={totals.fat} target={DEFAULT_TARGETS.fat} unit="g" gradient="from-amber-400 to-orange-500" bg="bg-amber-50" />
          </div>
        </div>
        {entries.length === 0 && (
          <p className="text-center text-slate-400 text-sm mt-4 pb-2">{T.noMealsYet}</p>
        )}
      </div>
    </div>
  );
}
