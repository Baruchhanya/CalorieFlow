"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark, Plus, X, Loader2, History } from "lucide-react";
import type { MealPreset, MealEntry } from "@/types";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

interface HistorySuggestion {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  count: number;
}

interface MealPresetsProps {
  currentDate: string;
  onAdded: (entries: MealEntry[]) => void;
  initialPresets?: MealPreset[];
  initialSuggestions?: HistorySuggestion[];
  onPresetsChange?: (presets: MealPreset[]) => void;
  onSuggestionsChange?: (suggestions: HistorySuggestion[]) => void;
}

export default function MealPresets({ currentDate, onAdded, initialPresets, initialSuggestions, onPresetsChange, onSuggestionsChange }: MealPresetsProps) {
  const { T, lang } = useLang();
  const { showToast } = useToast();
  const [presets, setPresetsLocal] = useState<MealPreset[]>(initialPresets ?? []);
  const [historyItems, setHistoryItemsLocal] = useState<HistorySuggestion[]>(initialSuggestions ?? []);
  const [loadingHistory, setLoadingHistory] = useState(!initialSuggestions);
  const [loading, setLoading] = useState(!initialPresets);

  // Sync with parent
  const setPresets = useCallback((updater: MealPreset[] | ((prev: MealPreset[]) => MealPreset[])) => {
    setPresetsLocal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      onPresetsChange?.(next);
      return next;
    });
  }, [onPresetsChange]);

  const setHistoryItems = useCallback((updater: HistorySuggestion[] | ((prev: HistorySuggestion[]) => HistorySuggestion[])) => {
    setHistoryItemsLocal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      onSuggestionsChange?.(next);
      return next;
    });
  }, [onSuggestionsChange]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addingHistoryKey, setAddingHistoryKey] = useState<string | null>(null);
  const [savingPresetKey, setSavingPresetKey] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meal-presets", { cache: "no-store" });
      if (!res.ok) throw new Error("load");
      const data = await res.json();
      setPresets(Array.isArray(data) ? data : []);
    } catch {
      setPresets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialPresets) load();
  }, [load, initialPresets]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/meal-suggestions", { cache: "no-store" });
      if (!res.ok) throw new Error("load");
      const data = await res.json();
      const items: HistorySuggestion[] = Array.isArray(data.items) ? data.items : [];
      setHistoryItems(items);
    } catch {
      setHistoryItems([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!initialSuggestions) loadHistory();
  }, [loadHistory, initialSuggestions]);

  const presetNameKeys = new Set(presets.map((p) => p.name.trim().toLowerCase()));
  const historyFiltered = historyItems.filter((h) => !presetNameKeys.has(h.name.trim().toLowerCase()));

  const addFromHistory = async (h: HistorySuggestion) => {
    const key = h.name.trim().toLowerCase();
    setAddingHistoryKey(key);
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
      showToast(T.recurringAdded, "success");
      onAdded(Array.isArray(saved) ? saved : [saved]);
    } catch {
      showToast(T.saveDiaryError, "error");
    } finally {
      setAddingHistoryKey(null);
    }
  };

  const saveHistoryAsPreset = async (h: HistorySuggestion) => {
    const key = h.name.trim().toLowerCase();
    setSavingPresetKey(key);
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
      setPresets((prev) => [...prev, row]);
      showToast(T.recurringSaved, "success");
    } catch {
      showToast(T.saveError, "error");
    } finally {
      setSavingPresetKey(null);
    }
  };

  const addFromPreset = async (p: MealPreset) => {
    setAddingId(p.id);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: currentDate,
          name: p.name,
          quantity: p.quantity ?? null,
          calories: p.calories,
          protein: p.protein,
          carbs: p.carbs,
          fat: p.fat,
          note: null,
        }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      showToast(T.recurringAdded, "success");
      onAdded(Array.isArray(saved) ? saved : [saved]);
    } catch {
      showToast(T.saveDiaryError, "error");
    } finally {
      setAddingId(null);
    }
  };

  const removePreset = async (p: MealPreset) => {
    if (!confirm(T.deleteRecurringConfirm(p.name))) return;
    try {
      const res = await fetch(`/api/meal-presets/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setPresets((prev) => prev.filter((x) => x.id !== p.id));
      showToast(T.recurringDeleted, "info");
    } catch {
      showToast(T.saveError, "error");
    }
  };

  const handleSavePreset = async () => {
    const n = name.trim();
    const c = Number(calories);
    if (!n) {
      showToast(T.manualNameRequired, "error");
      return;
    }
    if (!Number.isFinite(c) || c < 0) {
      showToast(T.manualCaloriesRequired, "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/meal-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          quantity: quantity.trim() || null,
          calories: c,
          protein: Number(protein) || 0,
          carbs: Number(carbs) || 0,
          fat: Number(fat) || 0,
        }),
      });
      if (!res.ok) throw new Error();
      const row = await res.json();
      setPresets((prev) => [...prev, row]);
      showToast(T.recurringSaved, "success");
      setShowForm(false);
      setName("");
      setQuantity("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
    } catch {
      showToast(T.saveError, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-start gap-2">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Bookmark className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-widest">{T.recurringMealsTitle}</h3>
          <p className="text-[11px] text-emerald-700/80 mt-0.5 leading-snug">{T.recurringMealsHint}</p>
        </div>
      </div>

      <div className="px-3 pb-3">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-emerald-600/60">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : presets.length === 0 && !showForm ? (
          <p className="text-sm text-slate-500 text-center py-4 px-2">{T.recurringEmpty}</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 touch-pan-x">
            {presets.map((p) => (
              <div
                key={p.id}
                dir="ltr"
                className="flex shrink-0 items-stretch rounded-2xl border border-emerald-200/80 bg-white/90 shadow-sm overflow-hidden max-w-[min(100%,20rem)]"
              >
                <button
                  type="button"
                  disabled={addingId === p.id}
                  onClick={() => addFromPreset(p)}
                  className="flex flex-col items-start gap-0.5 px-3 py-2.5 min-w-0 text-start hover:bg-emerald-50/80 active:bg-emerald-100/50 transition-colors disabled:opacity-60"
                >
                  {addingId === p.id ? (
                    <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                  ) : (
                    <>
                      <span className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">{p.name}</span>
                      <span className="text-xs font-semibold text-emerald-600 tabular-nums">
                        {Math.round(p.calories)} {T.kcal}
                        {(p.protein > 0 || p.carbs > 0 || p.fat > 0) && (
                          <span className="text-slate-400 font-normal ms-1">
                            P{p.protein.toFixed(0)} C{p.carbs.toFixed(0)} F{p.fat.toFixed(0)}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  title={lang === "he" ? "הסר מהרשימה" : "Remove from list"}
                  onClick={() => removePreset(p)}
                  className="shrink-0 px-2 border-s border-emerald-100 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* From diary history */}
        {(loadingHistory || historyFiltered.length > 0) && (
          <div className="mt-4 pt-4 border-t border-emerald-100/80">
            <div className="flex items-start gap-2 mb-2 px-1">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <History className="w-4 h-4 text-slate-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">{T.recurringFromHistoryTitle}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{T.recurringFromHistoryHint}</p>
              </div>
            </div>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-4 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 touch-pan-x">
                {historyFiltered.map((h) => {
                  const key = h.name.trim().toLowerCase();
                  const isAddingThis = addingHistoryKey === key;
                  const isSavingThis = savingPresetKey === key;
                  return (
                    <div
                      key={key}
                      dir="ltr"
                      className="flex shrink-0 items-stretch rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden max-w-[min(100%,18rem)]"
                    >
                      <button
                        type="button"
                        disabled={isAddingThis}
                        onClick={() => addFromHistory(h)}
                        className="flex flex-col items-start gap-0.5 px-3 py-2.5 min-w-[7rem] text-start hover:bg-slate-50 active:bg-slate-100/80 transition-colors disabled:opacity-60"
                      >
                        {isAddingThis ? (
                          <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                        ) : (
                          <>
                            <span className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">{h.name}</span>
                            <span className="text-xs font-semibold text-emerald-600 tabular-nums">
                              {Math.round(h.calories)} {T.kcal}
                              <span className="text-slate-400 font-normal ms-1">×{h.count}</span>
                            </span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isSavingThis}
                        title={lang === "he" ? "שמור כארוחה קבועה" : "Save as preset"}
                        onClick={() => saveHistoryAsPreset(h)}
                        className="shrink-0 px-2 border-s border-slate-100 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                      >
                        {isSavingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-emerald-300 text-emerald-700 text-sm font-bold hover:bg-emerald-50/80 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {T.addRecurringMeal}
          </button>
        ) : (
          <div className="mt-3 space-y-3 rounded-2xl border border-emerald-200 bg-white p-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={T.manualName}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={T.quantity}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <input
                type="number"
                min={0}
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder={T.manualCalories}
                className="flex-1 bg-transparent text-lg font-black text-amber-700 focus:outline-none placeholder:text-amber-300"
              />
              <span className="text-amber-600 text-sm font-semibold">{T.kcal}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={0}
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder={T.manualProtein}
                className="rounded-lg border border-slate-200 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                type="number"
                min={0}
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder={T.manualCarbs}
                className="rounded-lg border border-slate-200 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                type="number"
                min={0}
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder={T.manualFat}
                className="rounded-lg border border-slate-200 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleSavePreset}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? T.saving : T.saveRecurring}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                {T.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
