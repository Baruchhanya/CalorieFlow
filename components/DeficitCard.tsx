"use client";

import { useState, useEffect } from "react";
import { Flame, Pencil, Check, X, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

interface DeficitCardProps {
  consumed: number;
  burned: number;
  goalCalories: number;
  date: string;
  onBurnedChange: (v: number) => void;
  onGoalChange: (v: number) => void;
}

export default function DeficitCard({ consumed, burned, goalCalories, date, onBurnedChange, onGoalChange }: DeficitCardProps) {
  const { T, lang } = useLang();
  const { showToast } = useToast();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goalCalories));
  const [burnedInput, setBurnedInput] = useState(String(burned));
  const [savingBurned, setSavingBurned] = useState(false);

  useEffect(() => {
    if (!editingGoal) setGoalInput(String(goalCalories));
  }, [goalCalories, editingGoal]);

  const net = consumed - burned;
  const diff = goalCalories - net;
  const isDeficit = diff > 0;
  const diffAbs = Math.abs(Math.round(diff));
  const progressPct = Math.min((net / goalCalories) * 100, 100);

  const saveBurned = async (val: number) => {
    if (isNaN(val) || val < 0) return;
    setSavingBurned(true);
    try {
      await fetch("/api/activity", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, calories_burned: val }) });
      onBurnedChange(val);
      showToast(lang === "he" ? "קלוריות שרופות נשמרו" : "Burned calories saved", "success");
    } finally { setSavingBurned(false); }
  };

  const saveGoal = async () => {
    const val = Number(goalInput);
    if (isNaN(val) || val < 500 || val > 10000) {
      showToast(T.calorieGoalInvalidRange, "error");
      return;
    }
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ daily_goal_calories: val }) });
    onGoalChange(val);
    setEditingGoal(false);
    showToast(T.calorieGoalUpdated, "success");
  };

  const consumedLabel = lang === "he" ? "צרכת" : "Consumed";

  const stats = [
    { label: consumedLabel, value: Math.round(consumed), color: "#0f172a", bg: "bg-slate-50" },
    { label: T.burned, value: Math.round(burned), color: "#f59e0b", bg: "bg-amber-50" },
    { label: T.net, value: Math.round(net), color: "#6366f1", bg: "bg-indigo-50" },
  ];

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-slate-50">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{T.balance}</span>
        {editingGoal ? (
          <div className="flex items-center gap-1.5">
            <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveGoal()}
              className="w-24 text-sm border border-slate-200 rounded-xl px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            <button onClick={saveGoal} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-xl"><Check className="w-4 h-4" /></button>
            <button onClick={() => { setGoalInput(String(goalCalories)); setEditingGoal(false); }} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-xl"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button onClick={() => setEditingGoal(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 hover:bg-slate-50 rounded-xl transition-colors">
            <Pencil className="w-3 h-3" />
            {T.calorieGoal}: <span className="font-bold text-slate-600">{goalCalories.toLocaleString()}</span> {T.kcal}
          </button>
        )}
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Balance hero */}
        <div className={`rounded-2xl p-4 flex items-center gap-4 border ${isDeficit ? "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100" : "bg-gradient-to-br from-red-50 to-rose-50 border-red-100"}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${isDeficit ? "bg-emerald-100" : "bg-red-100"}`}>
            {isDeficit
              ? <TrendingDown className="w-6 h-6 text-emerald-600" />
              : <TrendingUp   className="w-6 h-6 text-red-500" />
            }
          </div>
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-widest mb-0.5 ${isDeficit ? "text-emerald-600" : "text-red-500"}`}>
              {isDeficit ? T.deficit : T.surplus}
            </p>
            <p className={`text-4xl font-black leading-none ${isDeficit ? "text-emerald-700" : "text-red-600"}`}>
              {diffAbs.toLocaleString()}
              <span className="text-sm font-semibold ms-1.5">{T.kcal}</span>
            </p>
          </div>
          {/* Mini progress arc */}
          <div className="ms-auto relative w-14 h-14 shrink-0">
            <svg viewBox="0 0 56 56" className="-rotate-90 w-full h-full">
              <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" strokeWidth="6" />
              <circle cx="28" cy="28" r="22" fill="none"
                stroke={isDeficit ? "#10b981" : "#ef4444"}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={138.2}
                strokeDashoffset={138.2 * (1 - progressPct / 100)}
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-600">
              {Math.round(progressPct)}%
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {stats.map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl py-3 px-2 text-center`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{s.label}</p>
              <p className="text-xl font-black" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">{T.kcal}</p>
            </div>
          ))}
        </div>

        {/* Burned input */}
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
          <Flame className="w-4 h-4 text-amber-500 shrink-0" />
          <input
            type="number" value={burnedInput}
            onChange={e => setBurnedInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveBurned(Number(burnedInput))}
            placeholder={T.caloriesBurnedPlaceholder}
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-amber-300"
            disabled={savingBurned} min={0}
          />
          <span className="text-xs text-amber-400 shrink-0">{T.kcal}</span>
          <button type="button" onClick={() => saveBurned(Number(burnedInput))} disabled={savingBurned}
            className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 touch-manipulation transition-all disabled:opacity-50 shadow-sm">
            {savingBurned ? <Flame className="w-3.5 h-3.5 animate-pulse" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
