"use client";

import { useEffect, useState } from "react";
import { Scale, X, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

interface Props {
  date: string;
  formattedDate: string;
  onSaved: (weightKg: number, dateSaved: string) => void;
  onClose: () => void;
}

export default function MorningWeightModal({ date, formattedDate, onSaved, onClose }: Props) {
  const { T } = useLang();
  const { showToast } = useToast();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

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
    const num = parseFloat(value);
    if (isNaN(num) || num < 20 || num > 300) return;
    setSaving(true);
    try {
      const res = await fetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight_kg: num, date }),
      });
      if (res.ok) {
        showToast(T.morningWeightSaved, "success");
        onSaved(num, date);
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
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800 leading-tight">{T.morningWeightTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={T.morningWeightSkip}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors disabled:opacity-50 touch-manipulation"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 sm:p-5 flex flex-col gap-4">
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 font-semibold">
            {T.morningWeightFor(formattedDate)}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">{T.morningWeightDesc}</p>

          <div
            dir="ltr"
            className="flex min-h-[3.5rem] items-stretch rounded-2xl border-2 border-slate-200 bg-slate-50/40 overflow-hidden transition-colors focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-200/60"
            style={{ unicodeBidi: "isolate" }}
          >
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              step="0.1"
              min="20"
              max="300"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder={T.morningWeightPlaceholder}
              className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-2xl font-black tabular-nums text-blue-600 placeholder:text-slate-300 focus:outline-none focus:ring-0 text-start"
            />
            <span className="flex shrink-0 items-center border-s-2 border-slate-200 bg-slate-100/80 px-4 text-sm font-bold text-slate-500">
              {T.morningWeightUnit}
            </span>
          </div>

          <div className="flex gap-3 pt-1"
            style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 min-h-[48px] py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 touch-manipulation"
            >
              {T.morningWeightSkip}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || value === ""}
              className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-600 active:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? T.saving : T.morningWeightSave}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
