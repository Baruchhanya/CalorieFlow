"use client";

import { useState } from "react";
import { Flame, Pencil, Check, X, CheckCircle2 } from "lucide-react";
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
  const { T } = useLang();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goalCalories));
  const [burnedInput, setBurnedInput] = useState(String(burned));
  const [savingBurned, setSavingBurned] = useState(false);

  const net = consumed - burned;
  const diff = goalCalories - net;
  const isDeficit = diff > 0;
  const diffAbs = Math.abs(Math.round(diff));

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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      {/* Title row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-800">{T.balance}</h2>
        {/* Goal edit */}
        {editingGoal ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="w-24 text-sm border border-slate-200 rounded-lg px-2 py-1 text-center"
              placeholder={T.goalPlaceholder}
            />
            <button onClick={saveGoal} className="p-1 text-emerald-600 hover:text-emerald-700"><Check className="w-4 h-4" /></button>
            <button onClick={() => { setGoalInput(String(goalCalories)); setEditingGoal(false); }} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button onClick={() => setEditingGoal(true)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <Pencil className="w-3 h-3" />
            {T.calorieGoal}: {goalCalories.toLocaleString()} {T.kcal}
          </button>
        )}
      </div>

      {/* Balance display */}
      <div className={`rounded-xl p-4 mb-4 text-center ${isDeficit ? "bg-emerald-50" : "bg-red-50"}`}>
        <p className="text-xs font-medium mb-1" style={{ color: isDeficit ? "#059669" : "#dc2626" }}>
          {isDeficit ? T.deficit : T.surplus}
        </p>
        <p className="text-3xl font-black" style={{ color: isDeficit ? "#059669" : "#dc2626" }}>
          {diffAbs.toLocaleString()}
          <span className="text-sm font-semibold mr-1"> {T.kcal}</span>
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        {[
          { label: T.calorieGoal.split(" ")[0] === "יעד" ? "צרכת" : "Consumed", value: Math.round(consumed), color: "text-slate-800" },
          { label: T.burned, value: Math.round(burned), color: "text-amber-600" },
          { label: T.net, value: Math.round(net), color: "text-indigo-600" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-50 rounded-xl py-2 px-1">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-lg font-black ${s.color}`}>{s.value.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400">{T.kcal}</p>
          </div>
        ))}
      </div>

      {/* Burned input */}
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-amber-500 shrink-0" />
        <input
          type="number"
          value={burnedInput}
          onChange={(e) => setBurnedInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveBurned(Number(burnedInput))}
          placeholder={T.caloriesBurnedPlaceholder}
          className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
          disabled={savingBurned}
          min={0}
        />
        <span className="text-xs text-slate-400 shrink-0">{T.kcal}</span>
        <button
          onClick={() => saveBurned(Number(burnedInput))}
          disabled={savingBurned}
          className="shrink-0 flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
          {savingBurned ? <Flame className="w-3.5 h-3.5 animate-pulse" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          OK
        </button>
      </div>
    </div>
  );
}
