"use client";

import { useState, useEffect } from "react";
import { Clock, CheckCircle, Pencil, X } from "lucide-react";
import { useLang } from "@/lib/i18n/context";

const PRESETS = [
  { key: "deficit", val: -500 },
  { key: "balance", val: 0 },
  { key: "surplus", val: 500 },
] as const;

function statusLabel(val: number, lang: string): string {
  const isHe = lang === "he";
  if (val < 0) return isHe ? `גרעון (${Math.abs(val).toLocaleString("he-IL")} קק"ל)` : `Deficit (${Math.abs(val).toLocaleString()} kcal)`;
  if (val > 0) return isHe ? `עודף (+${val.toLocaleString("he-IL")} קק"ל)` : `Surplus (+${val.toLocaleString()} kcal)`;
  return isHe ? 'איזון (0 קק"ל)' : "Balance (0 kcal)";
}

interface Props {
  date: string;
  onSaved?: () => void;
}

export default function UntrackedDayCard({ date, onSaved }: Props) {
  const { T, lang } = useLang();
  const isHe = lang === "he";

  const [existingBalance, setExistingBalance] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setEditing(false);
    fetch(`/api/day-acknowledgment?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.estimated_balance === "number") {
          setExistingBalance(data.estimated_balance);
          setInputVal(String(data.estimated_balance));
        } else {
          setExistingBalance(null);
          setInputVal("");
        }
      })
      .catch(() => {
        setExistingBalance(null);
        setInputVal("");
      })
      .finally(() => setLoaded(true));
  }, [date]);

  const handleSave = async () => {
    const val = parseInt(inputVal, 10);
    if (isNaN(val)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/day-acknowledgment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, estimated_balance: val }),
      });
      if (res.ok) {
        setExistingBalance(val);
        setEditing(false);
        onSaved?.();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/day-acknowledgment?date=${date}`, { method: "DELETE" });
      if (res.ok) {
        setExistingBalance(null);
        setInputVal("");
        setEditing(false);
        onSaved?.();
      }
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  // Confirmed state — already acknowledged, not editing
  if (existingBalance !== null && !editing) {
    const isDeficit = existingBalance < 0;
    const isSurplus = existingBalance > 0;
    return (
      <div
        className={`mt-3 rounded-2xl border p-4 flex items-start gap-3 transition-colors ${
          isDeficit
            ? "bg-emerald-50 border-emerald-100"
            : isSurplus
            ? "bg-red-50 border-red-100"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <CheckCircle
          className={`w-4 h-4 mt-0.5 shrink-0 ${
            isDeficit ? "text-emerald-500" : isSurplus ? "text-red-400" : "text-slate-400"
          }`}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-bold ${
              isDeficit ? "text-emerald-700" : isSurplus ? "text-red-600" : "text-slate-600"
            }`}
          >
            {T.untrackedAcknowledged}
          </p>
          <p
            className={`text-xs mt-0.5 ${
              isDeficit ? "text-emerald-600" : isSurplus ? "text-red-500" : "text-slate-500"
            }`}
          >
            {statusLabel(existingBalance, lang)}
          </p>
        </div>
        <button
          onClick={() => { setEditing(true); setInputVal(String(existingBalance)); }}
          className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-1"
          title={isHe ? "ערוך" : "Edit"}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Input form
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="text-sm font-bold text-slate-700">{T.untrackedDayTitle}</p>
        </div>
        {editing && (
          <button
            onClick={() => setEditing(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">{T.untrackedDayDesc}</p>

      {/* Quick presets */}
      <div className="flex gap-2">
        {PRESETS.map(({ key, val }) => {
          const label = key === "deficit" ? T.untrackedPresetDeficit
            : key === "balance" ? T.untrackedPresetBalance
            : T.untrackedPresetSurplus;
          const isActive = inputVal === String(val);
          const activeClass = key === "deficit"
            ? "bg-emerald-100 border-emerald-300 text-emerald-700"
            : key === "surplus"
            ? "bg-red-100 border-red-300 text-red-700"
            : "bg-slate-200 border-slate-300 text-slate-700";

          return (
            <button
              key={key}
              onClick={() => setInputVal(String(val))}
              className={`flex-1 text-xs font-semibold py-1.5 px-2 rounded-xl border transition-all ${
                isActive ? activeClass : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Number input + save */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={T.untrackedInputPlaceholder}
          className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-slate-50"
          dir="ltr"
        />
        <button
          onClick={handleSave}
          disabled={saving || inputVal === ""}
          className="text-sm font-semibold px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {saving ? T.untrackedSaving : T.untrackedSave}
        </button>
      </div>

      <p className="text-[10px] text-slate-400">{T.untrackedHint}</p>

      {/* Remove option when editing an existing acknowledgment */}
      {editing && (
        <button
          onClick={handleRemove}
          disabled={saving}
          className="text-xs text-red-400 hover:text-red-600 transition-colors self-start"
        >
          {T.untrackedRemove}
        </button>
      )}
    </div>
  );
}
