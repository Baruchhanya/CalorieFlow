"use client";

import { useState } from "react";
import { Trash2, Pencil, ChevronDown, ChevronUp, Flame } from "lucide-react";
import { MealEntry } from "@/types";
import { useLang } from "@/lib/i18n/context";

interface MealCardProps {
  entry: MealEntry;
  onDelete: (id: string) => void;
  onEdit: (entry: MealEntry) => void;
}

export default function MealCard({ entry, onDelete, onEdit }: MealCardProps) {
  const { T } = useLang();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const time = new Date(entry.created_at).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleDelete = async () => {
    if (!confirm(T.deleteConfirm(entry.name))) return;
    setDeleting(true);
    try {
      await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });
      onDelete(entry.id);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-xl border border-slate-100 shadow-sm transition-all duration-200 ${deleting ? "opacity-40 pointer-events-none" : ""}`}
    >
      <div className="flex items-center gap-3 p-4">
        <div className="flex-shrink-0 w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
          <Flame className="w-5 h-5 text-emerald-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 truncate">{entry.name}</span>
            {entry.quantity && (
              <span className="text-xs text-slate-400 shrink-0">{entry.quantity}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
            <span className="font-bold text-amber-600">{Math.round(entry.calories)} {T.kcal}</span>
            <span className="text-slate-300">•</span>
            <span>{T.protein.slice(0, 1)}: {Math.round(entry.protein)}g</span>
            <span>{T.carbs.slice(0, 1)}: {Math.round(entry.carbs)}g</span>
            <span>{T.fat.slice(0, 1)}: {Math.round(entry.fat)}g</span>
            <span className="sm:hidden text-slate-300">· {time}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-slate-400 ml-1 hidden sm:block">{time}</span>
          <button
            onClick={() => onEdit(entry)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 text-xs font-medium transition-colors"
            title={T.edit}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{T.edit}</span>
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            title={T.delete}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {entry.note && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
      {expanded && entry.note && (
        <div className="px-4 pb-3 text-sm text-slate-500 border-t border-slate-50 pt-2">
          {entry.note}
        </div>
      )}
    </div>
  );
}
