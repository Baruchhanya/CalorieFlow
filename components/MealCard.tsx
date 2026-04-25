"use client";

import { useState } from "react";
import { Trash2, Pencil, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { MealEntry } from "@/types";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

interface MealCardProps {
  entry: MealEntry;
  onDelete: (id: string) => void;
  onEdit: (entry: MealEntry) => void;
}

const ACCENTS = [
  { from: "#10b981", to: "#0d9488" },
  { from: "#3b82f6", to: "#6366f1" },
  { from: "#f59e0b", to: "#f97316" },
  { from: "#ec4899", to: "#f43f5e" },
  { from: "#8b5cf6", to: "#7c3aed" },
  { from: "#06b6d4", to: "#0891b2" },
];

function hashColor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return ACCENTS[Math.abs(h) % ACCENTS.length];
}

export default function MealCard({ entry, onDelete, onEdit }: MealCardProps) {
  const { T, lang } = useLang();
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const color = hashColor(entry.name);

  const time = new Date(entry.created_at).toLocaleTimeString(lang === "he" ? "he-IL" : "en-US", {
    hour: "2-digit", minute: "2-digit",
  });

  const initials = entry.name.split(" ").slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "").join("") || "?";

  const handleDelete = async () => {
    if (!confirm(T.deleteConfirm(entry.name))) return;
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
    <div className={`group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${deleting ? "opacity-40 scale-95 pointer-events-none" : ""}`}>
      <div className="absolute inset-y-0 start-0 w-1 rounded-s-2xl" style={{ background: `linear-gradient(to bottom, ${color.from}, ${color.to})` }} />

      <div className="flex items-center gap-3 p-4 ps-5">
        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white text-sm font-black shadow-sm"
          style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}>
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm leading-snug truncate">{entry.name}</p>
          {entry.quantity && <p className="text-xs text-slate-400 mt-0.5">{entry.quantity}</p>}

          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex h-1.5 rounded-full overflow-hidden flex-1 bg-slate-100">
              <div className="bg-blue-400 h-full" style={{ width: `${proteinPct}%` }} />
              <div className="bg-violet-400 h-full" style={{ width: `${carbsPct}%` }} />
              <div className="bg-amber-400 h-full" style={{ width: `${fatPct}%` }} />
            </div>
            <span className="text-xs text-slate-400 shrink-0">
              P{Math.round(entry.protein)} C{Math.round(entry.carbs)} F{Math.round(entry.fat)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-base font-black leading-none" style={{ color: color.from }}>
            {Math.round(entry.calories)}
            <span className="text-xs font-normal text-slate-400 ms-0.5">{T.kcal}</span>
          </span>
          <span className="text-[10px] text-slate-300 leading-none">{time}</span>

          <div className="flex items-center gap-0.5 mt-0.5">
            <button
              type="button"
              onClick={() => onEdit(entry)}
              aria-label={T.edit}
              title={T.edit}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition-colors touch-manipulation"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label={T.delete}
              title={T.delete}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors touch-manipulation disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
            {entry.note && (
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                aria-label={expanded ? "Collapse" : "Expand"}
                aria-expanded={expanded}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors touch-manipulation"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && entry.note && (
        <div className="px-5 py-2.5 text-xs text-slate-500 border-t border-slate-50 bg-slate-50/50 ps-5">
          {entry.note}
        </div>
      )}
    </div>
  );
}
