"use client";

import { useState, useEffect, memo } from "react";
import { Pencil, Check, X } from "lucide-react";
import { MealEntry, DEFAULT_TARGETS } from "@/types";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

function localTodayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

interface DailySummaryProps {
  entries: MealEntry[];
  goalCalories?: number;
  /** Active calories for the day (e.g. exercise); added to base goal for the ring and "out of" total. */
  caloriesBurned?: number;
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
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          {/* Track */}
          <circle cx="100" cy="100" r={r} fill="none" stroke="var(--color-line)" strokeWidth="12" strokeLinecap="round" />
          {/* Progress */}
          {consumed > 0 && (
            <circle
              cx="100" cy="100" r={r} fill="none"
              stroke={over ? "var(--color-over)" : "var(--color-kcal)"}
              strokeWidth="12" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
            />
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className={`text-4xl font-bold tabular-nums leading-none ${over ? "text-over" : "text-ink"}`}>
            {Math.round(consumed).toLocaleString()}
          </span>
          <span className="text-xs text-ink-3 font-medium">{T.kcal}</span>
          <div className={`mt-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full tabular-nums ${over ? "bg-over/10 text-over" : pct > 0.8 ? "bg-warn/10 text-warn" : "bg-brand-50 text-brand-700"}`}>
            {pctLabel}%
          </div>
        </div>
      </div>

      {/* Below ring */}
      <div className={`mt-3 text-sm font-semibold tabular-nums ${over ? "text-over" : "text-ink-2"}`}>
        {over
          ? `+${Math.round(consumed - target).toLocaleString()} ${T.kcal} ${T.exceededBy}`
          : `${T.remaining}: ${Math.round(remaining).toLocaleString()} ${T.kcal}`
        }
      </div>
    </div>
  );
}

function MacroTile({ label, value, target, unit, barClass }: {
  label: string; value: number; target: number; unit: string; barClass: string;
}) {
  const pct = Math.min((value / target) * 100, 100);
  const over = value > target;
  return (
    <div className="bg-canvas border border-line rounded-xl p-3.5 flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">{label}</span>
        <span className={`text-xs font-bold tabular-nums ${over ? "text-over" : "text-ink-2"}`}>
          {Math.round(value)}<span className="text-ink-3 font-normal">/{target}{unit}</span>
        </span>
      </div>
      <div className="h-2 bg-line/70 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barClass} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default memo(function DailySummary({ entries, goalCalories, caloriesBurned = 0, goalProtein, onGoalCaloriesChange }: DailySummaryProps) {
  const { T } = useLang();
  const { showToast } = useToast();
  const baseGoal = goalCalories ?? DEFAULT_TARGETS.calories;
  const activeExtra = Math.max(0, caloriesBurned);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(baseGoal));

  const parsedDraft = Number(goalDraft);
  const baseForRing =
    editingGoal && goalDraft.trim() !== "" && !Number.isNaN(parsedDraft) && parsedDraft >= 500 && parsedDraft <= 10000
      ? parsedDraft
      : baseGoal;
  const totalBudget = Math.max(baseForRing + activeExtra, 1);

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
        body: JSON.stringify({ daily_goal_calories: val, today_date: localTodayStr() }),
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
    <div className="bg-surface rounded-(--radius-card) shadow-(--shadow-card) border border-line overflow-hidden">
      {/* Title row */}
      <div className="px-5 sm:px-6 pt-5 pb-2 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest">{T.dailySummary}</span>
        {onGoalCaloriesChange ? (
          editingGoal ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveGoal()}
                className="w-28 text-sm border border-line rounded-lg px-2 py-1.5 text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                aria-label={T.goalPlaceholder}
              />
              <button type="button" onClick={saveGoal} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg" aria-label={T.save}>
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setGoalDraft(String(goalCalories ?? DEFAULT_TARGETS.calories));
                  setEditingGoal(false);
                }}
                className="p-1.5 text-ink-3 hover:bg-canvas rounded-lg"
                aria-label={T.cancel}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingGoal(true)}
              className="flex items-center gap-1.5 text-xs text-ink-2 hover:text-brand-700 px-2 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
              title={T.editGoal}
            >
              <Pencil className="w-3.5 h-3.5 shrink-0 opacity-70" />
              {T.editBaseGoalShort}
            </button>
          )
        ) : null}
      </div>

      {/* Large allowance = base + active (what you may eat today) */}
      <div className="px-4 sm:px-6 pb-5 text-center border-b border-line">
        <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1">{T.dailyAllowanceHeadline}</p>
        <p className="text-4xl sm:text-5xl font-bold text-ink tabular-nums leading-tight tracking-tight">
          {Math.round(totalBudget).toLocaleString()}
          <span className="text-lg sm:text-xl font-semibold text-ink-3 ms-1.5">{T.kcal}</span>
        </p>
        <p className="mt-2 text-sm text-ink-2 leading-snug tabular-nums">
          <span className="font-semibold text-ink">{baseForRing.toLocaleString()}</span>
          {" "}{T.allowanceBaseLabel}
          {activeExtra > 0 && (
            <>
              {" "}
              <span className="text-ink-3">+</span>{" "}
              <span className="font-semibold text-warn">{activeExtra.toLocaleString()}</span>
              {" "}{T.allowanceActiveLabel}
            </>
          )}
        </p>
      </div>

      {/* Ring — how much of that allowance you already ate */}
      <div className="flex justify-center py-4">
        <CalorieRing consumed={totals.calories} target={totalBudget} />
      </div>

      {/* Macro tiles */}
      <div className="px-5 pb-5 grid grid-cols-3 gap-2.5">
        <MacroTile label={T.protein} value={totals.protein} target={goalProtein ?? DEFAULT_TARGETS.protein} unit="g" barClass="bg-protein" />
        <MacroTile label={T.carbs} value={totals.carbs} target={DEFAULT_TARGETS.carbs} unit="g" barClass="bg-carbs" />
        <MacroTile label={T.fat} value={totals.fat} target={DEFAULT_TARGETS.fat} unit="g" barClass="bg-fat" />
      </div>
    </div>
  );
});
