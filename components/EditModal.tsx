"use client";

import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { MealEntry } from "@/types";
import { useLang } from "@/lib/i18n/context";

interface EditModalProps {
  entry: MealEntry | null;
  onSave: (entry: MealEntry) => void;
  onClose: () => void;
}

export default function EditModal({ entry, onSave, onClose }: EditModalProps) {
  const { T } = useLang();
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
    }
  }, [entry]);

  if (!entry) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          quantity: form.quantity || null,
          calories: parseFloat(form.calories) || 0,
          protein: parseFloat(form.protein) || 0,
          carbs: parseFloat(form.carbs) || 0,
          fat: parseFloat(form.fat) || 0,
          note: form.note || null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onSave(updated);
    } catch {
      setError(T.saveError);
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type = "text", step?: string) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type} step={step} value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">{T.editEntry}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {field(T.foodName, "name")}
          {field(T.quantity, "quantity")}
          <div className="grid grid-cols-2 gap-3">
            {field(`${T.kcal}`, "calories", "number", "1")}
            {field(`${T.protein} (g)`, "protein", "number", "0.1")}
            {field(`${T.carbs} (g)`, "carbs", "number", "0.1")}
            {field(`${T.fat} (g)`, "fat", "number", "0.1")}
          </div>
          {field(T.note, "note")}
          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
              {T.cancel}
            </button>
            <button type="submit" disabled={saving || !form.name}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Save className="w-4 h-4" />
              {saving ? T.saving : T.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
