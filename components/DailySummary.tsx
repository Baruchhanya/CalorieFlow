"use client";

import { MealEntry, DEFAULT_TARGETS } from "@/types";
import { useLang } from "@/lib/i18n/context";

interface DailySummaryProps {
  entries: MealEntry[];
}

interface MacroBarProps {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
  bgColor: string;
}

function MacroBar({ label, value, target, unit, color, bgColor }: MacroBarProps) {
  const pct = Math.min((value / target) * 100, 100);
  const over = value > target;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className={`font-semibold ${over ? "text-red-500" : "text-slate-600"}`}>
          {Math.round(value)}
          <span className="text-slate-400 font-normal">/{target}{unit}</span>
        </span>
      </div>
      <div className={`h-2.5 rounded-full ${bgColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${color} ${over ? "opacity-70" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const { T } = useLang();
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(consumed / target, 1);
  const offset = circumference * (1 - pct);
  const over = consumed > target;
  const remaining = Math.max(target - consumed, 0);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke={over ? "#ef4444" : "#10b981"}
            strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${over ? "text-red-500" : "text-slate-800"}`}>
            {Math.round(consumed)}
          </span>
          <span className="text-xs text-slate-500">{T.kcal}</span>
        </div>
      </div>
      <div className="text-center">
        {over ? (
          <p className="text-sm text-red-500 font-medium">
            {T.exceededBy} {Math.round(consumed - target)} {T.kcal}
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            {T.remaining}:{" "}
            <span className="font-semibold text-emerald-600">{Math.round(remaining)}</span>{" "}
            {T.kcal}
          </p>
        )}
        <p className="text-xs text-slate-400">
          {T.outOf} {target} {T.kcal}
        </p>
      </div>
    </div>
  );
}

export default function DailySummary({ entries }: DailySummaryProps) {
  const { T } = useLang();
  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <h2 className="text-lg font-bold text-slate-800 mb-4">{T.dailySummary}</h2>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <CalorieRing consumed={totals.calories} target={DEFAULT_TARGETS.calories} />
        <div className="flex-1 w-full flex flex-col gap-3">
          <MacroBar label={T.protein} value={totals.protein} target={DEFAULT_TARGETS.protein} unit="g" color="bg-blue-500" bgColor="bg-blue-100" />
          <MacroBar label={T.carbs} value={totals.carbs} target={DEFAULT_TARGETS.carbs} unit="g" color="bg-violet-500" bgColor="bg-violet-100" />
          <MacroBar label={T.fat} value={totals.fat} target={DEFAULT_TARGETS.fat} unit="g" color="bg-amber-500" bgColor="bg-amber-100" />
        </div>
      </div>
      {entries.length === 0 && (
        <p className="text-center text-slate-400 text-sm mt-4">{T.noMealsYet}</p>
      )}
    </div>
  );
}
