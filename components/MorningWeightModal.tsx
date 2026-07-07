"use client";

import { useState } from "react";
import { Scale, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";
import Modal from "@/components/ui/Modal";

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

  return (
    <Modal
      open
      onClose={onClose}
      closeDisabled={saving}
      closeLabel={T.morningWeightSkip}
      title={
        <span className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5 text-brand-600" />
          </span>
          {T.morningWeightTitle}
        </span>
      }
    >
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        <p className="text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2 font-semibold">
          {T.morningWeightFor(formattedDate)}
        </p>
        <p className="text-sm text-ink-2 leading-relaxed">{T.morningWeightDesc}</p>

        <div
          dir="ltr"
          className="flex min-h-[3.5rem] items-stretch rounded-xl border-2 border-line bg-canvas overflow-hidden transition-colors focus-within:border-brand-500 focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand-500/25"
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
            className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-2xl font-bold tabular-nums text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-0 text-start"
          />
          <span className="flex shrink-0 items-center border-s-2 border-line bg-line/40 px-4 text-sm font-bold text-ink-2">
            {T.morningWeightUnit}
          </span>
        </div>

        <div className="flex gap-3 pt-1"
          style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 min-h-[48px] py-2.5 rounded-xl border border-line text-ink-2 text-sm font-semibold hover:bg-canvas active:bg-line/50 transition-colors disabled:opacity-50 touch-manipulation"
          >
            {T.morningWeightSkip}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || value === ""}
            className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-700 active:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? T.saving : T.morningWeightSave}
          </button>
        </div>
      </div>
    </Modal>
  );
}
