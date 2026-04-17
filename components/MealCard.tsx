"use client";

import { useState } from "react";
import { Trash2, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { MealEntry } from "@/types";
import { useLang } from "@/lib/i18n/context";

interface MealCardProps {
  entry: MealEntry;
  onDelete: (id: string) => void;
  onEdit: (entry: MealEntry) => void;
}

const MEAL_COLORS = [
  "from-emerald-400 to-teal-500",
  "from-blue-400 to-indigo-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-sky-500",
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return MEAL_COLORS[Math.abs(hash) % MEAL_COLORS.length];
}

export default function MealCard({ entry, onDelete, onEdit }: MealCardProps) {
  const { T, lang } = useLang();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const time = new Date(entry.created_at).toLocaleTimeString(lang === "he" ? "he-IL" : "en-US", {
    hour: "2-digit", minute: "2-digit",
  });

  const initials = entry.name
    .split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

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
    <div className={`group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${deleting ? "opacity-40 pointer-events-none scale-95" : ""}`}>
      <div className="flex items-center gap-3 p-4">
        {/* Avatar */}
        <div className={`shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${getColor(entry.name)} flex items-center justify-center shadow-sm`}>
          <span className="text-white text-sm font-bold">{initials}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm leading-tight">{entry.name}</span>
            {entry.quantity && (
              <span className="text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md">{entry.quantity}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-sm font-bold text-amber-500">{Math.round(entry.calories)} {T.kcal}</span>
            <span className="text-slate-200">|</span>
            <span className="text-xs text-slate-400">{T.protein.slice(0,1)} {Math.round(entry.protein)}g</span>
            <span className="text-xs text-slate-400">{T.carbs.slice(0,1)} {Math.round(entry.carbs)}g</span>
            <span className="text-xs text-slate-400">{T.fat.slice(0,1)} {Math.round(entry.fat)}g</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] text-slate-300 hidden sm:block ml-1">{time}</span>
          <button onClick={() => onEdit(entry)} title={T.edit}
            className="p-2 rounded-xl hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors opacity-0 group-hover:opacity-100">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDelete} title={T.delete}
            className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {entry.note && (
            <button onClick={() => setExpanded((v) => !v)}
              className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Note */}
      {expanded && entry.note && (
        <div className="px-4 pb-3 pt-1 text-xs text-slate-500 border-t border-slate-50 bg-slate-50/50">
          {entry.note}
        </div>
      )}

      {/* Bottom calorie bar */}
      <div className="h-0.5 bg-slate-50">
        <div
          className={`h-full bg-gradient-to-r ${getColor(entry.name)} opacity-60`}
          style={{ width: `${Math.min((entry.calories / 800) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
