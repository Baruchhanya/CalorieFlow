"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Loader2, Plus, Bookmark, Pencil, Save, Search, Check } from "lucide-react";
import type { HistorySuggestion, MealEntry, MealPreset } from "@/types";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";
import Modal from "@/components/ui/Modal";

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

  const busy = !!addingKey || !!savingKey || savingEdit;

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

  const inputCls =
    "w-full rounded-xl border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40";
  const smallInputCls =
    "rounded-lg border border-line px-2 py-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500/40";

  return (
    <Modal open={open} onClose={onClose} closeDisabled={busy} maxWidthClass="sm:max-w-lg">
      {/* Header + search (sticky together) */}
      <div className="sticky top-0 z-10 bg-surface rounded-t-2xl border-b border-line">
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-ink">{T.historyModalTitle}</h3>
            <p className="text-xs text-ink-2 mt-0.5 leading-snug">{T.historyModalHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={T.cancel}
            className="ms-3 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-canvas active:bg-line/60 transition-colors disabled:opacity-50 touch-manipulation"
          >
            <X className="w-5 h-5 text-ink-3" />
          </button>
        </div>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-ink-3 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={T.historySearchPlaceholder}
              className="w-full rounded-xl border border-line ps-9 pe-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="px-3 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-ink-3">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-ink-2 py-10 text-sm">{T.historyEmpty}</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-ink-2 py-10 text-sm">{T.historyNoMatch}</p>
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
                    className="rounded-xl border border-brand-100 bg-brand-50/50 p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand-700 uppercase tracking-wide">
                        {T.historyEditFormTitle}
                      </span>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={savingEdit}
                        aria-label={T.cancel}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-canvas disabled:opacity-50"
                      >
                        <X className="w-4 h-4 text-ink-3" />
                      </button>
                    </div>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder={T.foodName}
                      className={inputCls}
                    />
                    <input
                      value={editForm.quantity}
                      onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                      placeholder={T.quantity}
                      className={inputCls}
                    />
                    <div className="flex items-center gap-2 bg-warn/10 border border-warn/20 rounded-xl px-3 py-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={editForm.calories}
                        onChange={(e) => setEditForm({ ...editForm, calories: e.target.value })}
                        placeholder={T.manualCalories}
                        className="flex-1 bg-transparent text-lg font-bold text-warn tabular-nums focus:outline-none placeholder:text-warn/40"
                      />
                      <span className="text-warn text-sm font-semibold">{T.kcal}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={editForm.protein}
                        onChange={(e) => setEditForm({ ...editForm, protein: e.target.value })}
                        placeholder={T.manualProtein}
                        className={smallInputCls}
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={editForm.carbs}
                        onChange={(e) => setEditForm({ ...editForm, carbs: e.target.value })}
                        placeholder={T.manualCarbs}
                        className={smallInputCls}
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={editForm.fat}
                        onChange={(e) => setEditForm({ ...editForm, fat: e.target.value })}
                        placeholder={T.manualFat}
                        className={smallInputCls}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={submitEdit}
                      disabled={savingEdit || !editForm.name.trim()}
                      className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-700 disabled:opacity-50"
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
                  className="rounded-xl border border-line bg-surface p-3 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink break-words">{h.name}</p>
                      <p className="text-xs font-semibold text-brand-600 tabular-nums mt-0.5">
                        {Math.round(h.calories)} {T.kcal}
                        {(h.protein > 0 || h.carbs > 0 || h.fat > 0) && (
                          <span className="text-ink-3 font-normal ms-1">
                            P{Math.round(h.protein)} C{Math.round(h.carbs)} F{Math.round(h.fat)}
                          </span>
                        )}
                        <span className="text-ink-3 font-normal ms-2">· {T.historyTimesEaten(h.count)}</span>
                      </p>
                    </div>
                    {alreadyPreset && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-brand-700 bg-brand-100 px-2 py-1 rounded-full uppercase tracking-wide">
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
                      className="flex items-center justify-center gap-1 py-2 rounded-xl bg-canvas border border-line text-ink text-xs font-semibold hover:bg-line/50 active:bg-line disabled:opacity-50 transition-colors"
                    >
                      {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span className="truncate">{T.historyAddToDay}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSaving || alreadyPreset}
                      onClick={() => saveAsPreset(h)}
                      className="flex items-center justify-center gap-1 py-2 rounded-xl bg-brand-100 text-brand-700 text-xs font-semibold hover:bg-brand-50 active:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
                      <span className="truncate">{T.historySavePreset}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(h)}
                      className="flex items-center justify-center gap-1 py-2 rounded-xl border border-brand-500/40 text-brand-700 text-xs font-semibold hover:bg-brand-50 active:bg-brand-100 transition-colors"
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
    </Modal>
  );
}
