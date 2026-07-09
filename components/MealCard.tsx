"use client";

import { useState, memo } from "react";
import { Trash2, Pencil, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { MealEntry } from "@/types";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";
import { useConfirm } from "@/lib/confirm/context";

interface MealCardProps {
  entry: MealEntry;
  onDelete: (id: string) => void;
  onEdit: (entry: MealEntry) => void;
}

export default memo(function MealCard({ entry, onDelete, onEdit }: MealCardProps) {
  const { T, lang } = useLang();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const time = new Date(entry.created_at).toLocaleTimeString(lang === "he" ? "he-IL" : "en-US", {
    hour: "2-digit", minute: "2-digit",
  });

  const initials = entry.name.split(" ").slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "").join("") || "?";

  const handleDelete = async () => {
    if (!(await confirm({ message: T.deleteConfirm(entry.name), confirmLabel: T.delete }))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDelete(entry.id);
      showToast(T.mealDeleted(entry.name), "info");
    } catch {
      setDeleting(false);
      showToast(T.deleteFailed, "error");
    }
  };

  const totalMacroKcal = entry.protein * 4 + entry.carbs * 4 + entry.fat * 9;
  const proteinPct = totalMacroKcal > 0 ? (entry.protein * 4 / totalMacroKcal) * 100 : 0;
  const carbsPct   = totalMacroKcal > 0 ? (entry.carbs   * 4 / totalMacroKcal) * 100 : 0;
  const fatPct     = totalMacroKcal > 0 ? (entry.fat     * 9 / totalMacroKcal) * 100 : 0;

  return (
    <div className={`group relative bg-surface rounded-(--radius-card) border border-line shadow-(--shadow-card) hover:shadow-md transition-all duration-200 overflow-hidden ${deleting ? "opacity-40 scale-95 pointer-events-none" : ""}`}>
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-brand-50 text-brand-700 text-sm font-bold">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink text-sm leading-snug truncate">{entry.name}</p>
          {entry.quantity && <p className="text-xs text-ink-3 mt-0.5">{entry.quantity}</p>}

          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex h-1.5 rounded-full overflow-hidden flex-1 bg-line/60">
              <div className="bg-protein h-full" style={{ width: `${proteinPct}%` }} />
              <div className="bg-carbs h-full" style={{ width: `${carbsPct}%` }} />
              <div className="bg-fat h-full" style={{ width: `${fatPct}%` }} />
            </div>
            <span className="text-xs text-ink-3 shrink-0 tabular-nums">
              P{Math.round(entry.protein)} C{Math.round(entry.carbs)} F{Math.round(entry.fat)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-base font-bold leading-none text-kcal tabular-nums">
            {Math.round(entry.calories)}
            <span className="text-xs font-normal text-ink-3 ms-0.5">{T.kcal}</span>
          </span>
          <span className="text-[10px] text-ink-3 leading-none tabular-nums">{time}</span>

          <div className="flex items-center gap-0.5 mt-0.5">
            <button
              type="button"
              onClick={() => onEdit(entry)}
              aria-label={T.edit}
              title={T.edit}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-ink-3 hover:text-brand-600 hover:bg-brand-50 active:bg-brand-100 transition-colors touch-manipulation"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label={T.delete}
              title={T.delete}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-ink-3 hover:text-over hover:bg-over/10 active:bg-over/15 transition-colors touch-manipulation disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
            {entry.note && (
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                aria-label={expanded ? "Collapse" : "Expand"}
                aria-expanded={expanded}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-ink-3 hover:text-ink hover:bg-canvas active:bg-line/50 transition-colors touch-manipulation"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && entry.note && (
        <div className="px-4 py-2.5 text-xs text-ink-2 border-t border-line bg-canvas">
          {entry.note}
        </div>
      )}
    </div>
  );
});
