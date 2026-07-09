"use client";

import { useState, useEffect, memo } from "react";
import { Pencil, Check, X, Flame, ChevronDown, CheckCircle2 } from "lucide-react";
import { MealEntry, DEFAULT_TARGETS } from "@/types";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

function localTodayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

interface TodaySummaryCardProps {
  entries: MealEntry[];
  goalCalories?: number;
  /** Active calories for the day (e.g. exercise); added to the base goal for the allowance/ring. */
  caloriesBurned?: number;
  goalProtein?: number;
  date: string;
  /** When set, the base calorie goal can be edited here. Omit for read-only (past days). */
  onGoalCaloriesChange?: (value: number) => void;
  /** Persist a new active-burn value for the day. */
  onBurnedChange: (value: number) => void;
}

// ─── Calorie ring — the single hero of the home screen ───────────────────────
function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const { T } = useLang();
  const r = 80;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(consumed / target, 1);
  const offset = circ * (1 - pct);
  const over = consumed > target;
  const pctLabel = Math.round((consumed / target) * 100);

  return (
    <div className="relative w-52 h-52">
      <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--color-line)" strokeWidth="12" strokeLinecap="round" />
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
        <div className={`h-full rounded-full ${barClass} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default memo(function TodaySummaryCard({
  entries, goalCalories, caloriesBurned = 0, goalProtein, date, onGoalCaloriesChange, onBurnedChange,
}: TodaySummaryCardProps) {
  const { T, lang } = useLang();
  const { showToast } = useToast();

  const baseGoal = goalCalories ?? DEFAULT_TARGETS.calories;
  const activeExtra = Math.max(0, caloriesBurned);

  // ── Goal editing (single place) ──
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

  // ── Totals ──
  const totals = entries.reduce(
    (a, e) => ({ calories: a.calories + e.calories, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const consumed = totals.calories;
  const over = consumed > totalBudget;
  const remaining = Math.max(totalBudget - consumed, 0);

  // ── Details / balance (collapsed by default) ──
  const [showDetails, setShowDetails] = useState(false);
  const net = consumed - caloriesBurned;
  const stats = [
    { label: T.statDailyIntake, value: Math.round(consumed), valueClass: "text-ink" },
    { label: T.statActiveBurnDaily, value: Math.round(caloriesBurned), valueClass: "text-fat" },
    { label: T.statIntakeMinusActivity, value: Math.round(net), valueClass: "text-protein" },
  ];

  // ── Burned-calories input (active vs total-from-watch) ──
  const [burnMode, setBurnMode] = useState<"active" | "total">("total");
  const [burnedInput, setBurnedInput] = useState(() =>
    caloriesBurned === 0 ? "" : String(Math.round(caloriesBurned + baseGoal))
  );
  const [savingBurned, setSavingBurned] = useState(false);

  useEffect(() => {
    setBurnMode("total");
    setBurnedInput(caloriesBurned === 0 ? "" : String(Math.round(caloriesBurned + baseGoal)));
  }, [caloriesBurned, baseGoal, date]);

  const switchBurnMode = (next: "active" | "total") => {
    if (next === burnMode) return;
    const num = burnedInput.trim() === "" ? NaN : Number(burnedInput);
    if (!Number.isNaN(num) && num >= 0) {
      const converted = next === "total" ? Math.round(num + baseGoal) : Math.max(0, Math.round(num - baseGoal));
      setBurnedInput(String(converted));
    }
    setBurnMode(next);
  };

  const saveBurned = async (raw: string) => {
    const t = raw.trim();
    const entered = t === "" ? 0 : Number(t);
    if (t !== "" && (isNaN(entered) || entered < 0)) {
      showToast(lang === "he" ? "נא להזין מספר חיובי או להשאיר ריק" : "Enter a positive number or leave empty", "error");
      return;
    }
    const active = burnMode === "total" ? Math.max(0, Math.round(entered - baseGoal)) : entered;
    setSavingBurned(true);
    try {
      await fetch("/api/activity", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, calories_burned: active }),
      });
      onBurnedChange(active);
      setBurnedInput(active === 0 ? "" : String(burnMode === "total" ? Math.round(active + baseGoal) : active));
      showToast(lang === "he" ? "קלוריות שרופות נשמרו" : "Burned calories saved", "success");
    } finally { setSavingBurned(false); }
  };

  return (
    <div className="bg-surface rounded-(--radius-card) shadow-(--shadow-card) border border-line overflow-hidden">
      {/* Header: title + single goal-edit affordance */}
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
                onClick={() => { setGoalDraft(String(goalCalories ?? DEFAULT_TARGETS.calories)); setEditingGoal(false); }}
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

      {/* Hero: single ring + one status line (remaining / over) */}
      <div className="flex flex-col items-center pt-2 pb-5">
        <CalorieRing consumed={consumed} target={totalBudget} />

        <div className={`mt-3 text-sm font-semibold tabular-nums ${over ? "text-over" : "text-ink-2"}`}>
          {over
            ? `+${Math.round(consumed - totalBudget).toLocaleString()} ${T.kcal} ${T.exceededBy}`
            : `${T.remaining}: ${Math.round(remaining).toLocaleString()} ${T.kcal}`}
        </div>

        {/* Allowance caption — the "of Y", with base + active breakdown when relevant */}
        <p className="mt-1 text-xs text-ink-3 tabular-nums text-center px-4">
          {T.outOf} <span className="font-semibold text-ink-2">{Math.round(totalBudget).toLocaleString()}</span> {T.kcal}
          {activeExtra > 0 && (
            <span className="block text-[11px] mt-0.5">
              {T.calorieBudgetBreakdown(baseForRing, activeExtra)}
            </span>
          )}
        </p>
      </div>

      {/* Macros — always visible */}
      <div className="px-5 pb-4 grid grid-cols-3 gap-2.5">
        <MacroTile label={T.protein} value={totals.protein} target={goalProtein ?? DEFAULT_TARGETS.protein} unit="g" barClass="bg-protein" />
        <MacroTile label={T.carbs} value={totals.carbs} target={DEFAULT_TARGETS.carbs} unit="g" barClass="bg-carbs" />
        <MacroTile label={T.fat} value={totals.fat} target={DEFAULT_TARGETS.fat} unit="g" barClass="bg-fat" />
      </div>

      {/* Details & balance — collapsed by default */}
      <div className="border-t border-line">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          className="w-full flex items-center justify-center gap-1.5 px-5 py-3 text-xs font-semibold text-ink-2 hover:bg-canvas transition-colors touch-manipulation"
        >
          {showDetails ? T.hideDetails : T.detailsAndBalance}
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`} />
        </button>

        {showDetails && (
          <div className="px-5 pb-5 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-1 duration-200">
            {/* Intake / active burn / net */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {stats.map((s) => (
                <div key={s.label} className="bg-canvas border border-line rounded-xl py-2.5 px-1.5 sm:px-2 text-center">
                  <p className="text-[11px] sm:text-xs font-semibold text-ink-3 leading-tight mb-1.5 min-h-[3rem] flex items-end justify-center text-center px-0.5">
                    {s.label}
                  </p>
                  <p className={`text-lg sm:text-xl font-bold tabular-nums ${s.valueClass}`}>{s.value.toLocaleString()}</p>
                  <p className="text-[10px] text-ink-3">{T.kcal}</p>
                </div>
              ))}
            </div>

            {/* Burned-calories input */}
            <div className="flex flex-col gap-2.5 bg-canvas border border-line rounded-xl px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-fat uppercase tracking-wider min-w-0">
                  <Flame className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{T.caloriesBurnedPlaceholder}</span>
                </div>
                <div className="flex shrink-0 rounded-lg border border-line bg-surface overflow-hidden text-[11px] font-bold" role="group">
                  <button
                    type="button"
                    onClick={() => switchBurnMode("active")}
                    disabled={savingBurned}
                    className={`px-2.5 py-1 transition-colors ${burnMode === "active" ? "bg-brand-600 text-white" : "text-ink-2 hover:bg-canvas"}`}
                  >
                    {T.burnModeActive}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchBurnMode("total")}
                    disabled={savingBurned}
                    className={`px-2.5 py-1 border-s border-line transition-colors ${burnMode === "total" ? "bg-brand-600 text-white" : "text-ink-2 hover:bg-canvas"}`}
                  >
                    {T.burnModeTotal}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number" value={burnedInput}
                  onChange={(e) => setBurnedInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveBurned(burnedInput)}
                  placeholder="0"
                  className="flex-1 min-w-0 text-base bg-transparent focus:outline-none placeholder:text-ink-3/50 tabular-nums"
                  disabled={savingBurned} min={0}
                />
                <span className="text-xs text-ink-3 shrink-0">{T.kcal}</span>
                <button
                  type="button" onClick={() => saveBurned(burnedInput)} disabled={savingBurned}
                  className="shrink-0 min-h-[44px] flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl active:scale-95 touch-manipulation transition-all disabled:opacity-50"
                >
                  {savingBurned ? <Flame className="w-3.5 h-3.5 animate-pulse" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  OK
                </button>
              </div>
              <p className="text-[11px] text-ink-3 leading-snug">
                {burnMode === "total"
                  ? (Number(burnedInput) > 0 && Number(burnedInput) < baseGoal
                    ? T.burnModeTotalBelowBmr(baseGoal)
                    : T.burnModeTotalHint(baseGoal))
                  : T.burnModeActiveHint}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
