"use client";

import { useState } from "react";
import { Flame, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";
import Modal from "@/components/ui/Modal";
import OuraConnectPanel from "@/components/OuraConnectPanel";

interface Props {
  date: string;
  formattedDate: string;
  initialValue?: number;
  /** Base daily goal (BMR) for this date — used to convert "total" entry to active. */
  baseGoal: number;
  onSaved: (caloriesBurned: number, dateSaved: string) => void;
  onClose: () => void;
}

export default function YesterdayBurnModal({ date, formattedDate, initialValue, baseGoal, onSaved, onClose }: Props) {
  const { T } = useLang();
  const { showToast } = useToast();
  const [mode, setMode] = useState<"active" | "total">("total");
  const [value, setValue] = useState(
    initialValue && initialValue > 0
      ? String(Math.round(initialValue + baseGoal))
      : ""
  );
  const [saving, setSaving] = useState(false);

  const switchMode = (next: "active" | "total") => {
    if (next === mode) return;
    const num = value.trim() === "" ? NaN : Number(value);
    if (!Number.isNaN(num) && num >= 0) {
      const converted = next === "total"
        ? Math.round(num + baseGoal)
        : Math.max(0, Math.round(num - baseGoal));
      setValue(String(converted));
    }
    setMode(next);
  };

  const handleSave = async () => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    const active = mode === "total" ? Math.max(0, Math.round(num - baseGoal)) : num;
    setSaving(true);
    try {
      const res = await fetch("/api/activity", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, calories_burned: active }),
      });
      if (res.ok) {
        showToast(T.yesterdayBurnSaved, "success");
        onSaved(active, date);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      closeDisabled={saving}
      closeLabel={T.yesterdayBurnSkip}
      title={
        <span className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-warn/10 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 text-warn" />
          </span>
          {T.yesterdayBurnTitle}
        </span>
      }
    >
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        <p className="text-xs text-warn bg-warn/10 border border-warn/20 rounded-xl px-3 py-2 font-semibold">
          {T.yesterdayBurnFor(formattedDate)}
        </p>
        <p className="text-sm text-ink-2 leading-relaxed">{T.yesterdayBurnDesc}</p>

        <OuraConnectPanel date={date} onSynced={(caloriesBurned) => onSaved(caloriesBurned, date)} />

        <div className="flex rounded-xl border border-line bg-canvas overflow-hidden text-xs font-bold" role="group">
          <button
            type="button"
            onClick={() => switchMode("active")}
            disabled={saving}
            className={`flex-1 py-2 transition-colors ${mode === "active" ? "bg-brand-600 text-white" : "text-ink-2 hover:bg-line/40"}`}
          >
            {T.burnModeActive}
          </button>
          <button
            type="button"
            onClick={() => switchMode("total")}
            disabled={saving}
            className={`flex-1 py-2 border-s border-line transition-colors ${mode === "total" ? "bg-brand-600 text-white" : "text-ink-2 hover:bg-line/40"}`}
          >
            {T.burnModeTotal}
          </button>
        </div>

        <input
          type="number"
          inputMode="numeric"
          autoFocus
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder={T.yesterdayBurnPlaceholder}
          className="w-full rounded-xl border border-line px-4 py-3 text-base font-semibold text-ink tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-transparent bg-canvas"
          dir="ltr"
        />

        <p className="text-[11px] text-ink-3 leading-snug">
          {mode === "total"
            ? (Number(value) > 0 && Number(value) < baseGoal
              ? T.burnModeTotalBelowBmr(baseGoal)
              : T.burnModeTotalHint(baseGoal))
            : T.burnModeActiveHint}
        </p>

        <div className="flex gap-3 pt-1"
          style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 min-h-[48px] py-2.5 rounded-xl border border-line text-ink-2 text-sm font-semibold hover:bg-canvas active:bg-line/50 transition-colors disabled:opacity-50 touch-manipulation"
          >
            {T.yesterdayBurnSkip}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || value === ""}
            className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-700 active:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? T.saving : T.yesterdayBurnSave}
          </button>
        </div>
      </div>
    </Modal>
  );
}
