"use client";

import { useEffect, useState } from "react";
import { Flame, X, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

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
  const [value, setValue] = useState(initialValue && initialValue > 0 ? String(Math.round(initialValue)) : "");
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"active" | "total">("active");

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, saving]);

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

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !saving) onClose();
  };

  return (
    <div
      onClick={onBackdropClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800 leading-tight">{T.yesterdayBurnTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={T.yesterdayBurnSkip}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors disabled:opacity-50 touch-manipulation"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 sm:p-5 flex flex-col gap-4">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 font-semibold">
            {T.yesterdayBurnFor(formattedDate)}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">{T.yesterdayBurnDesc}</p>

          <div className="flex rounded-xl border border-slate-200 bg-slate-50 overflow-hidden text-xs font-bold" role="group">
            <button
              type="button"
              onClick={() => setMode("active")}
              disabled={saving}
              className={`flex-1 py-2 transition-colors ${mode === "active" ? "bg-amber-500 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {T.burnModeActive}
            </button>
            <button
              type="button"
              onClick={() => setMode("total")}
              disabled={saving}
              className={`flex-1 py-2 border-s border-slate-200 transition-colors ${mode === "total" ? "bg-amber-500 text-white" : "text-slate-600 hover:bg-slate-100"}`}
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
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-slate-50"
            dir="ltr"
          />

          <p className="text-[11px] text-slate-500 leading-snug">
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
              className="flex-1 min-h-[48px] py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 touch-manipulation"
            >
              {T.yesterdayBurnSkip}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || value === ""}
              className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-amber-600 active:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? T.saving : T.yesterdayBurnSave}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
