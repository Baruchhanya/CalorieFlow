"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Loader2, Plus, Bookmark, Pencil, Save, Search, Check } from "lucide-react";
import type { HistorySuggestion, MealEntry, MealPreset } from "@/types";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

interface MealHistoryModalProps {
  open: boolean;
  currentDate: string;
  presetNameKeys: Set<string>;
  onAdded: (entries: MealEntry[]) => void;
  onPresetSaved: (preset: MealPreset) => void;
  onClose: () => void;
}

interface EditForm {
  name: string;
  quantity: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

export default function MealHistoryModal({
  open,
  currentDate,
  presetNameKeys,
  onAdded,
  onPresetSaved,
  onClose,
}: MealHistoryModalProps) {
  const { T } = useLang();
  const { showToast } = useToast();

  const [items, setItems] = useState<HistorySuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meal-suggestions?limit=all", { cache: "no-store" });
      if (!res.ok) throw new Error("load");
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Lock body scroll + close on Escape
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !addingKey && !savingKey && !savingEdit) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, addingKey, savingKey, savingEdit]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [items, query]);

  const addToDay = async (h: HistorySuggestion) => {
    const key = h.name.trim().toLowerCase();
    setAddingKey(key);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: currentDate,
          name: h.name,
          quantity: null,
          calories: h.calories,
          protein: h.protein,
          carbs: h.carbs,
          fat: h.fat,
          note: null,
        }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      onAdded(Array.isArray(saved) ? saved : [saved]);
      showToast(T.recurringAdded, "success");
    } catch {
      showToast(T.saveDiaryError, "error");
    } finally {
      setAddingKey(null);
    }
  };

  const saveAsPreset = async (h: HistorySuggestion) => {
    const key = h.name.trim().toLowerCase();
    setSavingKey(key);
    try {
      const res = await fetch("/api/meal-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: h.name,
          quantity: null,
          calories: h.calories,
          protein: h.protein,
          carbs: h.carbs,
          fat: h.fat,
        }),
      });
      if (!res.ok) throw new Error();
      const row = await res.json();
      onPresetSaved(row);
      showToast(T.recurringSaved, "success");
    } catch {
      showToast(T.saveError, "error");
    } finally {
      setSavingKey(null);
    }
  };

  const startEdit = (h: HistorySuggestion) => {
    const key = h.name.trim().toLowerCase();
    setEditingKey(key);
    setEditForm({
      name: h.name,
      quantity: "",
      calories: String(Math.round(h.calories)),
      protein: String(Math.round(h.protein)),
      carbs: String(Math.round(h.carbs)),
      fat: String(Math.round(h.fat)),
    });
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditForm(null);
  };

  const submitEdit = async () => {
    if (!editForm) return;
    const name = editForm.name.trim();
    const calories = Number(editForm.calories);
    if (!name) {
      showToast(T.manualNameRequired, "error");
      return;
    }
    if (!Number.isFinite(calories) || calories < 0) {
      showToast(T.manualCaloriesRequired, "error");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch("/api/meal-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          quantity: editForm.quantity.trim() || null,
          calories,
          protein: Number(editForm.protein) || 0,
          carbs: Number(editForm.carbs) || 0,
          fat: Number(editForm.fat) || 0,
        }),
      });
      if (!res.ok) throw new Error();
      const row = await res.json();
      onPresetSaved(row);
      showToast(T.recurringSaved, "success");
      cancelEdit();
    } catch {
      showToast(T.saveError, "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !addingKey && !savingKey && !savingEdit) onClose();
  };

  if (!open) return null;

  return (
    <div
      onClick={onBackdropClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white rounded-t-3xl sm:rounded-t-2xl flex items-center justify-between p-4 border-b border-slate-100">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-slate-800">{T.historyModalTitle}</h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{T.historyModalHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!!addingKey || !!savingKey || savingEdit}
            aria-label={T.cancel}
            className="ms-3 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors disabled:opacity-50 touch-manipulation"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2 bg-white border-b border-slate-100">
          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={T.historySearchPlaceholder}
              className="w-full rounded-xl border border-slate-200 ps-9 pe-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-slate-500 py-10 text-sm">{T.historyEmpty}</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-500 py-10 text-sm">{T.historyNoMatch}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((h) => {
                const key = h.name.trim().toLowerCase();
                const isAdding = addingKey === key;
                const isSaving = savingKey === key;
                const isEditing = editingKey === key;
                const alreadyPreset = presetNameKeys.has(key);

                if (isEditing && editForm) {
                  return (
                    <li
                      key={key}
                      className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                          {T.historyEditFormTitle}
                        </span>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={savingEdit}
                          aria-label={T.cancel}
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-50"
                        >
                          <X className="w-4 h-4 text-slate-500" />
                        </button>
                      </div>
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder={T.foodName}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                      <input
                        value={editForm.quantity}
                        onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                        placeholder={T.quantity}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={editForm.calories}
                          onChange={(e) => setEditForm({ ...editForm, calories: e.target.value })}
                          placeholder={T.manualCalories}
                          className="flex-1 bg-transparent text-lg font-black text-amber-700 focus:outline-none placeholder:text-amber-300"
                        />
                        <span className="text-amber-600 text-sm font-semibold">{T.kcal}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={editForm.protein}
                          onChange={(e) => setEditForm({ ...editForm, protein: e.target.value })}
                          placeholder={T.manualProtein}
                          className="rounded-lg border border-slate-200 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={editForm.carbs}
                          onChange={(e) => setEditForm({ ...editForm, carbs: e.target.value })}
                          placeholder={T.manualCarbs}
                          className="rounded-lg border border-slate-200 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={editForm.fat}
                          onChange={(e) => setEditForm({ ...editForm, fat: e.target.value })}
                          placeholder={T.manualFat}
                          className="rounded-lg border border-slate-200 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={submitEdit}
                        disabled={savingEdit || !editForm.name.trim()}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {savingEdit ? T.saving : T.saveRecurring}
                      </button>
                    </li>
                  );
                }

                return (
                  <li
                    key={key}
                    className="rounded-2xl border border-slate-200 bg-white p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 break-words">{h.name}</p>
                        <p className="text-xs font-semibold text-emerald-600 tabular-nums mt-0.5">
                          {Math.round(h.calories)} {T.kcal}
                          {(h.protein > 0 || h.carbs > 0 || h.fat > 0) && (
                            <span className="text-slate-400 font-normal ms-1">
                              P{Math.round(h.protein)} C{Math.round(h.carbs)} F{Math.round(h.fat)}
                            </span>
                          )}
                          <span className="text-slate-400 font-normal ms-2">· {T.historyTimesEaten(h.count)}</span>
                        </p>
                      </div>
                      {alreadyPreset && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full uppercase tracking-wide">
                          <Check className="w-3 h-3" />
                          {T.historyAlreadyPreset}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        disabled={isAdding}
                        onClick={() => addToDay(h)}
                        className="flex items-center justify-center gap-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 transition-colors"
                      >
                        {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        <span className="truncate">{T.historyAddToDay}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSaving || alreadyPreset}
                        onClick={() => saveAsPreset(h)}
                        className="flex items-center justify-center gap-1 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-semibold hover:bg-emerald-200 active:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
                        <span className="truncate">{T.historySavePreset}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(h)}
                        className="flex items-center justify-center gap-1 py-2 rounded-xl border border-emerald-300 text-emerald-700 text-xs font-semibold hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="truncate">{T.historyEditAndSave}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
