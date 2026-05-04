"use client";

import { useState, useEffect } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { MealEntry } from "@/types";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

interface EditModalProps {
  entry: MealEntry | null;
  onSave: (entry: MealEntry) => void;
  onClose: () => void;
}

export default function EditModal({ entry, onSave, onClose }: EditModalProps) {
  const { T } = useLang();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: "", quantity: "", calories: "", protein: "", carbs: "", fat: "", note: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (entry) {
      setForm({
        name: entry.name,
        quantity: entry.quantity ?? "",
        calories: String(Math.round(entry.calories)),
        protein: String(Math.round(entry.protein)),
        carbs: String(Math.round(entry.carbs)),
        fat: String(Math.round(entry.fat)),
        note: entry.note ?? "",
      });
      setError("");
    }
  }, [entry]);

  // Lock body scroll while open + close on Escape
  useEffect(() => {
    if (!entry) return;
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
  }, [entry, onClose, saving]);

  if (!entry) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(T.foodName);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          quantity: form.quantity.trim() || null,
          calories: parseFloat(form.calories) || 0,
          protein: parseFloat(form.protein) || 0,
          carbs: parseFloat(form.carbs) || 0,
          fat: parseFloat(form.fat) || 0,
          note: form.note.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onSave(updated);
      showToast(T.mealUpdated(updated.name ?? form.name), "success");
    } catch {
      setError(T.saveError);
    } finally {
      setSaving(false);
    }
  };

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !saving) onClose();
  };

  const textField = (label: string, key: "name" | "quantity" | "note") => (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type="text"
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
      />
    </div>
  );

  const numField = (label: string, key: "calories" | "protein" | "carbs" | "fat", step: string) => (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min="0"
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
      />
    </div>
  );

  return (
    <div
      onClick={onBackdropClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white flex items-center justify-between p-4 sm:p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">{T.editEntry}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={T.cancel}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors disabled:opacity-50 touch-manipulation"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 flex flex-col gap-3">
          {textField(T.foodName, "name")}
          {textField(T.quantity, "quantity")}
          <div className="grid grid-cols-2 gap-3">
            {numField(T.kcal, "calories", "1")}
            {numField(`${T.protein} (g)`, "protein", "0.1")}
            {numField(`${T.carbs} (g)`, "carbs", "0.1")}
            {numField(`${T.fat} (g)`, "fat", "0.1")}
          </div>
          {textField(T.note, "note")}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white -mx-4 sm:-mx-5 px-4 sm:px-5 -mb-4 sm:-mb-5 border-t border-slate-100 sm:border-t-0"
            style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 min-h-[48px] py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 touch-manipulation"
            >
              {T.cancel}
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 active:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? T.saving : T.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
