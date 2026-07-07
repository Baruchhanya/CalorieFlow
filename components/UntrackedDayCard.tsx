"use client";

import { useState, useEffect } from "react";
import { Clock, CheckCircle, Pencil, X } from "lucide-react";
import { useLang } from "@/lib/i18n/context";

const TYPE_KEYS = ["deficit", "balance", "surplus"] as const;
type DayType = typeof TYPE_KEYS[number];

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
        className={`mt-3 rounded-xl border p-4 flex items-start gap-3 transition-colors ${
          isDeficit
            ? "bg-brand-50 border-brand-100"
            : isSurplus
            ? "bg-over/8 border-over/15"
            : "bg-canvas border-line"
        }`}
      >
        <CheckCircle
          className={`w-4 h-4 mt-0.5 shrink-0 ${
            isDeficit ? "text-brand-500" : isSurplus ? "text-over" : "text-ink-3"
          }`}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-bold ${
              isDeficit ? "text-brand-700" : isSurplus ? "text-over" : "text-ink-2"
            }`}
          >
            {T.untrackedAcknowledged}
          </p>
          <p
            className={`text-xs mt-0.5 ${
              isDeficit ? "text-brand-600" : isSurplus ? "text-over" : "text-ink-2"
            }`}
          >
            {statusLabel(existingBalance, lang)}
          </p>
        </div>
        <button
          onClick={() => { setEditing(true); setInputVal(String(existingBalance)); }}
          className="shrink-0 text-ink-3 hover:text-ink-2 transition-colors p-1"
          title={isHe ? "ערוך" : "Edit"}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Input form
  return (
    <div className="mt-3 rounded-(--radius-card) border border-line bg-surface p-4 flex flex-col gap-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-ink-3 shrink-0" />
          <p className="text-sm font-bold text-ink">{T.untrackedDayTitle}</p>
        </div>
        {editing && (
          <button
            onClick={() => setEditing(false)}
            className="text-ink-3 hover:text-ink-2 transition-colors p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-xs text-ink-2 leading-relaxed">{T.untrackedDayDesc}</p>

      {/* Type buttons — highlight based on current input sign, click flips sign or sets 0 */}
      <div className="flex gap-2">
        {TYPE_KEYS.map((key) => {
          const label = key === "deficit" ? T.untrackedPresetDeficit
            : key === "balance" ? T.untrackedPresetBalance
            : T.untrackedPresetSurplus;

          const numVal = parseInt(inputVal, 10);
          const isActive = !isNaN(numVal) && (
            key === "deficit" ? numVal < 0
            : key === "surplus" ? numVal > 0
            : numVal === 0
          );

          const activeClass = key === "deficit"
            ? "bg-brand-100 border-brand-500/40 text-brand-700"
            : key === "surplus"
            ? "bg-over/15 border-over/40 text-over"
            : "bg-line border-ink-3/40 text-ink";

          const handleClick = () => {
            if (key === "balance") { setInputVal("0"); return; }
            const cur = parseInt(inputVal, 10);
            if (!isNaN(cur) && cur !== 0) {
              // Flip sign to match selected type
              if (key === "deficit" && cur > 0) setInputVal(String(-cur));
              if (key === "surplus" && cur < 0) setInputVal(String(Math.abs(cur)));
            }
          };

          return (
            <button
              key={key}
              onClick={handleClick}
              className={`flex-1 text-xs font-semibold py-1.5 px-2 rounded-xl border transition-all ${
                isActive ? activeClass : "bg-canvas border-line text-ink-2 hover:bg-line/50"
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
          className="flex-1 text-sm border border-line rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/40 bg-canvas tabular-nums"
          dir="ltr"
        />
        <button
          onClick={handleSave}
          disabled={saving || inputVal === ""}
          className="text-sm font-semibold px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {saving ? T.untrackedSaving : T.untrackedSave}
        </button>
      </div>

      <p className="text-[10px] text-ink-3">{T.untrackedHint}</p>

      {/* Remove option when editing an existing acknowledgment */}
      {editing && (
        <button
          onClick={handleRemove}
          disabled={saving}
          className="text-xs text-over/70 hover:text-over transition-colors self-start"
        >
          {T.untrackedRemove}
        </button>
      )}
    </div>
  );
}
