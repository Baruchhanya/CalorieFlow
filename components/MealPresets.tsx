"use client";

import { useState, useEffect } from "react";
import { Bookmark, Plus, X, Loader2, History, ChevronLeft } from "lucide-react";
import type { MealPreset, MealEntry, HistorySuggestion } from "@/types";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";
import { useConfirm } from "@/lib/confirm/context";
import MealHistoryModal from "@/components/MealHistoryModal";

interface MealPresetsProps {
  currentDate: string;
  onAdded: (entries: MealEntry[]) => void;
  initialPresets?: MealPreset[];
  initialSuggestions?: HistorySuggestion[];
}

export default function MealPresets({ currentDate, onAdded, initialPresets, initialSuggestions }: MealPresetsProps) {
  const { T, lang } = useLang();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [presets, setPresets] = useState<MealPreset[]>(initialPresets ?? []);
  const [historyItems, setHistoryItems] = useState<HistorySuggestion[]>(initialSuggestions ?? []);
  const [loadingHistory, setLoadingHistory] = useState(!initialSuggestions);
  const [loading, setLoading] = useState(!initialPresets);

  const [addingId, setAddingId] = useState<string | null>(null);
  const [addingHistoryKey, setAddingHistoryKey] = useState<string | null>(null);
  const [savingPresetKey, setSavingPresetKey] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  // Parent supplies presets/suggestions via initial* props (from /api/init
  // phase=secondary). Track them here and clear the skeletons once they arrive.
  // The component no longer self-fetches on mount — that duplicated the
  // secondary request. Mutations below update local state directly.
  useEffect(() => {
    if (initialPresets) {
      setPresets(initialPresets);
      setLoading(false);
    }
  }, [initialPresets]);

  useEffect(() => {
    if (initialSuggestions) {
      setHistoryItems(initialSuggestions);
      setLoadingHistory(false);
    }
  }, [initialSuggestions]);

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
    if (!(await confirm({ message: T.deleteRecurringConfirm(p.name), confirmLabel: T.delete }))) return;
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
    <section className="rounded-(--radius-card) border border-line bg-canvas overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-start gap-2">
        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <Bookmark className="w-5 h-5 text-brand-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[11px] font-semibold text-ink uppercase tracking-widest">{T.recurringMealsTitle}</h3>
          <p className="text-[11px] text-ink-3 mt-0.5 leading-snug">{T.recurringMealsHint}</p>
        </div>
      </div>

      <div className="px-3 pb-3">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-brand-600/60">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : presets.length === 0 && !showForm ? (
          <p className="text-sm text-ink-2 text-center py-4 px-2">{T.recurringEmpty}</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 touch-pan-x">
            {presets.map((p) => (
              <div
                key={p.id}
                dir="ltr"
                className="flex shrink-0 items-stretch rounded-xl border border-line bg-surface shadow-(--shadow-card) overflow-hidden max-w-[min(100%,20rem)]"
              >
                <button
                  type="button"
                  disabled={addingId === p.id}
                  onClick={() => addFromPreset(p)}
                  className="flex flex-col items-start gap-0.5 px-3 py-2.5 min-w-0 text-start hover:bg-brand-50 active:bg-brand-100 transition-colors disabled:opacity-60"
                >
                  {addingId === p.id ? (
                    <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
                  ) : (
                    <>
                      <span className="text-sm font-bold text-ink line-clamp-2 leading-tight">{p.name}</span>
                      <span className="text-xs font-semibold text-brand-600 tabular-nums">
                        {Math.round(p.calories)} {T.kcal}
                        {(p.protein > 0 || p.carbs > 0 || p.fat > 0) && (
                          <span className="text-ink-3 font-normal ms-1">
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
                  className="shrink-0 px-2 border-s border-line text-ink-3/60 hover:text-over hover:bg-over/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* From diary history */}
        {(loadingHistory || historyFiltered.length > 0) && (
          <div className="mt-4 pt-4 border-t border-line">
            <div className="flex items-start gap-2 mb-2 px-1">
              <div className="w-8 h-8 rounded-xl bg-line/50 flex items-center justify-center shrink-0">
                <History className="w-4 h-4 text-ink-2" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[11px] font-semibold text-ink uppercase tracking-widest">{T.recurringFromHistoryTitle}</h3>
                <p className="text-[11px] text-ink-3 mt-0.5 leading-snug">{T.recurringFromHistoryHint}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="shrink-0 inline-flex items-center gap-0.5 text-brand-700 text-xs font-bold hover:underline transition-colors"
              >
                {T.historySeeAll}
                <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
              </button>
            </div>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-4 text-ink-3">
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
                      className="flex shrink-0 items-stretch rounded-xl border border-line bg-surface shadow-(--shadow-card) overflow-hidden max-w-[min(100%,18rem)]"
                    >
                      <button
                        type="button"
                        disabled={isAddingThis}
                        onClick={() => addFromHistory(h)}
                        className="flex flex-col items-start gap-0.5 px-3 py-2.5 min-w-[7rem] text-start hover:bg-canvas active:bg-line/50 transition-colors disabled:opacity-60"
                      >
                        {isAddingThis ? (
                          <Loader2 className="w-5 h-5 text-ink-2 animate-spin" />
                        ) : (
                          <>
                            <span className="text-sm font-bold text-ink line-clamp-2 leading-tight">{h.name}</span>
                            <span className="text-xs font-semibold text-brand-600 tabular-nums">
                              {Math.round(h.calories)} {T.kcal}
                              <span className="text-ink-3 font-normal ms-1">×{h.count}</span>
                            </span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isSavingThis}
                        title={lang === "he" ? "שמור כארוחה קבועה" : "Save as preset"}
                        onClick={() => saveHistoryAsPreset(h)}
                        className="shrink-0 px-2 border-s border-line text-ink-3/60 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50"
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
            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-brand-500/40 text-brand-700 text-sm font-bold hover:bg-brand-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {T.addRecurringMeal}
          </button>
        ) : (
          <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface p-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={T.manualName}
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={T.quantity}
              className="w-full rounded-xl border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
            <div className="flex items-center gap-2 bg-warn/10 border border-warn/20 rounded-xl px-3 py-2">
              <input
                type="number"
                min={0}
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder={T.manualCalories}
                className="flex-1 bg-transparent text-lg font-bold text-warn tabular-nums focus:outline-none placeholder:text-warn/40"
              />
              <span className="text-warn text-sm font-semibold">{T.kcal}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={0}
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder={T.manualProtein}
                className="rounded-lg border border-line px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
              <input
                type="number"
                min={0}
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder={T.manualCarbs}
                className="rounded-lg border border-line px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
              <input
                type="number"
                min={0}
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder={T.manualFat}
                className="rounded-lg border border-line px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleSavePreset}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? T.saving : T.saveRecurring}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl border border-line text-sm font-semibold text-ink-2 hover:bg-canvas"
              >
                {T.cancel}
              </button>
            </div>
          </div>
        )}
      </div>

      <MealHistoryModal
        open={showHistoryModal}
        currentDate={currentDate}
        presetNameKeys={presetNameKeys}
        onAdded={(entries) => onAdded(entries)}
        onPresetSaved={(preset) => setPresets((prev) => [...prev, preset])}
        onClose={() => setShowHistoryModal(false)}
      />
    </section>
  );
}
