"use client";

import { useState } from "react";
import { Flame, Pencil, Check, X, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { useLang } from "@/lib/i18n/context";

interface DeficitCardProps {
  consumed: number;
  burned: number;
  goalCalories: number;
  date: string;
  onBurnedChange: (v: number) => void;
  onGoalChange: (v: number) => void;
}

export default function DeficitCard({
  consumed, burned, goalCalories, date, onBurnedChange, onGoalChange,
}: DeficitCardProps) {
  const { T, lang } = useLang();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goalCalories));
  const [burnedInput, setBurnedInput] = useState(String(burned));
  const [savingBurned, setSavingBurned] = useState(false);

  const net = consumed - burned;
  const diff = goalCalories - net;
  const isDeficit = diff > 0;
  const diffAbs = Math.abs(Math.round(diff));
  const progressPct = Math.min((net / goalCalories) * 100, 100);

  const saveBurned = async (val: number) => {
    if (isNaN(val) || val < 0) return;
    setSavingBurned(true);
    try {
      await fetch("/api/activity", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, calories_burned: val }),
      });
      onBurnedChange(val);
    } finally {
      setSavingBurned(false);
    }
  };

  const saveGoal = async () => {
    const val = Number(goalInput);
    if (isNaN(val) || val < 500 || val > 10000) return;
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_goal_calories: val }),
    });
    onGoalChange(val);
    setEditingGoal(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{T.balance}</h2>
        {editingGoal ? (
          <div className="flex items-center gap-1.5">
            <input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveGoal()}
              className="w-24 text-sm border border-slate-200 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-emerald-300"
              placeholder={T.goalPlaceholder} />
            <button onClick={saveGoal} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Check className="w-4 h-4" /></button>
            <button onClick={() => { setGoalInput(String(goalCalories)); setEditingGoal(false); }}
              className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button onClick={() => setEditingGoal(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 hover:bg-slate-50 rounded-lg">
            <Pencil className="w-3 h-3" />
            {T.calorieGoal}: <span className="font-bold text-slate-600">{goalCalories.toLocaleString()}</span> {T.kcal}
          </button>
        )}
      </div>

      <div className="p-5">
        {/* Big balance display */}
        <div className={`rounded-2xl p-5 mb-4 flex items-center gap-4 ${isDeficit ? "bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100" : "bg-gradient-to-br from-red-50 to-rose-50 border border-red-100"}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDeficit ? "bg-emerald-100" : "bg-red-100"}`}>
            {isDeficit
              ? <TrendingDown className="w-6 h-6 text-emerald-600" />
              : <TrendingUp className="w-6 h-6 text-red-500" />
            }
          </div>
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-0.5 ${isDeficit ? "text-emerald-600" : "text-red-500"}`}>
              {isDeficit ? T.deficit : T.surplus}
            </p>
            <p className={`text-4xl font-black leading-none ${isDeficit ? "text-emerald-700" : "text-red-600"}`}>
              {diffAbs.toLocaleString()}
              <span className="text-base font-semibold ms-1">{T.kcal}</span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            { label: lang === "he" ? "צרכת" : "Consumed", value: Math.round(consumed), color: "text-slate-700", bg: "bg-slate-50" },
            { label: T.burned, value: Math.round(burned), color: "text-amber-600", bg: "bg-amber-50" },
            { label: T.net, value: Math.round(net), color: "text-indigo-600", bg: "bg-indigo-50" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-2xl py-3 px-2 text-center`}>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-xl font-black ${s.color}`}>{s.value.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">{T.kcal}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>0</span>
            <span className="font-medium text-slate-500">{T.net}: {Math.round(net).toLocaleString()} / {goalCalories.toLocaleString()}</span>
            <span>{goalCalories.toLocaleString()}</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isDeficit ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-gradient-to-r from-red-400 to-rose-500"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Burned input */}
        <div className="flex items-center gap-2 bg-amber-50 rounded-xl p-3">
          <Flame className="w-4 h-4 text-amber-500 shrink-0" />
          <input
            type="number"
            value={burnedInput}
            onChange={(e) => setBurnedInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveBurned(Number(burnedInput))}
            placeholder={T.caloriesBurnedPlaceholder}
            className="flex-1 text-sm bg-white border border-amber-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
            disabled={savingBurned}
            min={0}
          />
          <span className="text-xs text-slate-400 shrink-0">{T.kcal}</span>
          <button
            onClick={() => saveBurned(Number(burnedInput))}
            disabled={savingBurned}
            className="shrink-0 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50 shadow-sm">
            {savingBurned ? <Flame className="w-3.5 h-3.5 animate-pulse" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
