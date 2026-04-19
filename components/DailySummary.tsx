"use client";

import { useState, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { MealEntry, DEFAULT_TARGETS } from "@/types";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

interface DailySummaryProps {
  entries: MealEntry[];
  goalCalories?: number;
  goalProtein?: number;
  /** When set, user can edit daily calorie target from the summary header (saved via `/api/settings`). */
  onGoalCaloriesChange?: (value: number) => void;
}

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const { T } = useLang();
  const r = 80;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(consumed / target, 1);
  const offset = circ * (1 - pct);
  const over = consumed > target;
  const remaining = Math.max(target - consumed, 0);
  const pctLabel = Math.round((consumed / target) * 100);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-52 h-52">
        {/* Glow */}
        <div className={`absolute inset-8 rounded-full blur-2xl opacity-20 transition-colors duration-500 ${over ? "bg-red-500" : "bg-emerald-400"}`} />

        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id="cGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>
            <linearGradient id="cGradOver" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          {/* Track */}
          <circle cx="100" cy="100" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
          {/* Progress */}
          {consumed > 0 && (
            <circle
              cx="100" cy="100" r={r} fill="none"
              stroke={over ? "url(#cGradOver)" : "url(#cGrad)"}
              strokeWidth="12" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              filter="url(#glow)"
              style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
            />
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className={`text-4xl font-black leading-none ${over ? "text-red-500" : "text-slate-800"}`}>
            {Math.round(consumed).toLocaleString()}
          </span>
          <span className="text-xs text-slate-400 font-medium">{T.kcal}</span>
          <div className={`mt-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${over ? "bg-red-100 text-red-600" : pct > 0.8 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
            {pctLabel}%
          </div>
        </div>
      </div>

      {/* Below ring */}
      <div className={`mt-3 text-sm font-semibold ${over ? "text-red-500" : "text-slate-500"}`}>
        {over
          ? `+${Math.round(consumed - target).toLocaleString()} ${T.kcal} ${T.exceededBy}`
          : `${T.remaining}: ${Math.round(remaining).toLocaleString()} ${T.kcal}`
        }
      </div>
    </div>
  );
}

function MacroTile({ label, value, target, unit, from, to, bg }: {
  label: string; value: number; target: number; unit: string;
  from: string; to: string; bg: string;
}) {
  const pct = Math.min((value / target) * 100, 100);
  const over = value > target;
  return (
    <div className={`${bg} rounded-2xl p-3.5 flex flex-col gap-2`}>
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</span>
        <span className={`text-xs font-bold ${over ? "text-red-500" : "text-slate-600"}`}>
          {Math.round(value)}<span className="text-slate-400 font-normal">/{target}{unit}</span>
        </span>
      </div>
      <div className="h-2 bg-white/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${from} ${to} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function DailySummary({ entries, goalCalories, goalProtein, onGoalCaloriesChange }: DailySummaryProps) {
  const { T } = useLang();
  const { showToast } = useToast();
  const target = goalCalories ?? DEFAULT_TARGETS.calories;
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(target));

  useEffect(() => {
    if (!editingGoal) setGoalDraft(String(goalCalories ?? DEFAULT_TARGETS.calories));
  }, [goalCalories, editingGoal]);

  const saveGoal = async () => {
    const val = Number(goalDraft);
    if (isNaN(val) || val < 500 || val > 10000) {
      showToast(T.calorieGoalInvalidRange, "error");
      return;
    }
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_goal_calories: val }),
      });
      if (!res.ok) throw new Error("settings");
      onGoalCaloriesChange?.(val);
      setEditingGoal(false);
      showToast(T.calorieGoalUpdated, "success");
    } catch {
      showToast(T.saveError, "error");
    }
  };

  const totals = entries.reduce(
    (a, e) => ({ calories: a.calories + e.calories, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-1 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{T.dailySummary}</span>
        {onGoalCaloriesChange ? (
          editingGoal ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveGoal()}
                className="w-24 text-sm border border-slate-200 rounded-xl px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-emerald-300"
                aria-label={T.goalPlaceholder}
              />
              <button type="button" onClick={saveGoal} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-xl" aria-label={T.save}>
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setGoalDraft(String(goalCalories ?? DEFAULT_TARGETS.calories));
                  setEditingGoal(false);
                }}
                className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-xl"
                aria-label={T.cancel}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingGoal(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-700 px-2 py-1 rounded-xl hover:bg-emerald-50/80 transition-colors text-end"
              title={T.editGoal}
            >
              <span>
                {T.outOf} <span className="font-bold text-slate-600">{target.toLocaleString()}</span> {T.kcal}
              </span>
              <Pencil className="w-3.5 h-3.5 shrink-0 opacity-70" />
            </button>
          )
        ) : (
          <span className="text-xs text-slate-400">
            {T.outOf} {target.toLocaleString()} {T.kcal}
          </span>
        )}
      </div>

      {/* Ring */}
      <div className="flex justify-center py-4">
        <CalorieRing consumed={totals.calories} target={target} />
      </div>

      {/* Macro tiles */}
      <div className="px-5 pb-5 grid grid-cols-3 gap-2.5">
        <MacroTile label={T.protein} value={totals.protein} target={goalProtein ?? DEFAULT_TARGETS.protein} unit="g"
          from="from-blue-400" to="to-indigo-500" bg="bg-blue-50" />
        <MacroTile label={T.carbs} value={totals.carbs} target={DEFAULT_TARGETS.carbs} unit="g"
          from="from-violet-400" to="to-purple-500" bg="bg-violet-50" />
        <MacroTile label={T.fat} value={totals.fat} target={DEFAULT_TARGETS.fat} unit="g"
          from="from-amber-400" to="to-orange-500" bg="bg-amber-50" />
      </div>
    </div>
  );
}
