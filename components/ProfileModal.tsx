"use client";

import { useState, useEffect } from "react";
import { X, User, Save, Ruler, Weight, Calendar, Info, Flame } from "lucide-react";
import { UserProfile, calcProteinGoal } from "@/types";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

interface ProfileModalProps {
  initialProfile: UserProfile | null;
  /** Current daily calorie target (from app state / settings). */
  dailyGoalCalories: number;
  onSave: (profile: UserProfile) => void;
  onClose: () => void;
  isFirstTime?: boolean;
  onDailyGoalSaved?: (goal: number) => void;
}

export default function ProfileModal({ initialProfile, dailyGoalCalories, onSave, onClose, isFirstTime, onDailyGoalSaved }: ProfileModalProps) {
  const { lang, T: gT } = useLang();
  const { showToast } = useToast();
  const [height, setHeight] = useState(String(initialProfile?.height_cm ?? ""));
  const [weight, setWeight] = useState(String(initialProfile?.weight_kg ?? ""));
  const [age, setAge] = useState(String(initialProfile?.age ?? ""));
  const [dailyGoalStr, setDailyGoalStr] = useState(String(dailyGoalCalories));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDailyGoalStr(String(dailyGoalCalories));
  }, [dailyGoalCalories]);

  const previewProfile: UserProfile = {
    height_cm: Number(height) || null,
    weight_kg: Number(weight) || null,
    age: Number(age) || null,
  };
  const proteinGoal = calcProteinGoal(previewProfile);

  const profileT = lang === "he" ? {
    title: isFirstTime ? "ברוך הבא! הגדר את הפרופיל שלך" : "פרופיל אישי",
    subtitle: isFirstTime ? "כדי לחשב את יעד החלבון שלך" : "עדכן את הפרטים שלך",
    height: "גובה (ס״מ)",
    weight: "משקל (ק״ג)",
    age: "גיל",
    proteinTitle: "יעד חלבון יומי שלך",
    proteinNote: "מחושב לפי משקלך",
    proteinFormula: (kg: number, factor: number) => `${kg} ק״ג × ${factor} = `,
    save: "שמור פרופיל",
    skip: "דלג בינתיים",
    errorWeight: "משקל לא תקין (20-300)",
    errorAge: "גיל לא תקין (10-120)",
    heightPlaceholder: "לדוג׳ 175",
    weightPlaceholder: "לדוג׳ 75",
    agePlaceholder: "לדוג׳ 30",
    factorNote: (age: number) => age >= 60 ? "(מבוגר מעל 60: ×1.4)" : "(×1.2 לאדם צעיר)",
    errorCalorieGoal: "יעד קלורי לא תקין (500–10,000)",
  } : {
    title: isFirstTime ? "Welcome! Set up your profile" : "Personal Profile",
    subtitle: isFirstTime ? "To calculate your daily protein goal" : "Update your details",
    height: "Height (cm)",
    weight: "Weight (kg)",
    age: "Age",
    proteinTitle: "Your daily protein goal",
    proteinNote: "Calculated from your weight",
    proteinFormula: (kg: number, factor: number) => `${kg} kg × ${factor} = `,
    save: "Save Profile",
    skip: "Skip for now",
    errorWeight: "Invalid weight (20-300)",
    errorAge: "Invalid age (10-120)",
    heightPlaceholder: "e.g. 175",
    weightPlaceholder: "e.g. 75",
    agePlaceholder: "e.g. 30",
    factorNote: (age: number) => age >= 60 ? "(60+: ×1.4 for muscle preservation)" : "(×1.2 standard)",
    errorCalorieGoal: "Invalid calorie goal (500–10,000)",
  };
  const T = { ...gT, ...profileT };

  const handleSave = async () => {
    const w = Number(weight);
    const a = Number(age);
    const g = Number(dailyGoalStr);
    if (weight && (w < 20 || w > 300)) { setError(T.errorWeight); return; }
    if (age && (a < 10 || a > 120)) { setError(T.errorAge); return; }
    if (dailyGoalStr.trim() !== "" && (Number.isNaN(g) || g < 500 || g > 10000)) {
      setError(T.errorCalorieGoal);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const profile: UserProfile = {
        height_cm: Number(height) || null,
        weight_kg: w || null,
        age: a || null,
      };
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (dailyGoalStr.trim() !== "" && !Number.isNaN(g) && g >= 500 && g <= 10000) {
        const sRes = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ daily_goal_calories: g }),
        });
        if (sRes.ok) onDailyGoalSaved?.(g);
        else showToast(T.saveError, "error");
      }
      showToast(lang === "he" ? "הפרופיל נשמר" : "Profile saved", "success");
      onSave(profile);
    } finally {
      setSaving(false);
    }
  };

  const factor = (Number(age) || 0) >= 60 ? 1.4 : 1.2;
  const hasWeight = Boolean(weight && Number(weight) > 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in scale-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5 text-white relative">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
            <User className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black leading-tight">{T.title}</h2>
          <p className="text-blue-100 text-sm mt-1">{T.subtitle}</p>
          {!isFirstTime && (
            <button onClick={onClose} className="absolute top-4 end-4 p-1.5 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6 flex flex-col gap-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          {/* Fields */}
          {[
            { icon: <Ruler className="w-4 h-4 text-slate-400" />, label: T.height, val: height, set: setHeight, placeholder: T.heightPlaceholder, unit: "cm" },
            { icon: <Weight className="w-4 h-4 text-blue-500" />, label: T.weight, val: weight, set: setWeight, placeholder: T.weightPlaceholder, unit: "kg" },
            { icon: <Calendar className="w-4 h-4 text-slate-400" />, label: T.age, val: age, set: setAge, placeholder: T.agePlaceholder, unit: lang === "he" ? "שנים" : "years" },
          ].map((f) => (
            <div key={f.label} className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                {f.icon}{f.label}
              </label>
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-300">
                <input
                  type="number" value={f.val} onChange={(e) => f.set(e.target.value)}
                  placeholder={f.placeholder} min={0}
                  className="flex-1 px-4 py-2.5 text-sm focus:outline-none"
                />
                <span className="px-3 text-xs text-slate-400 font-medium bg-slate-50 border-s border-slate-200 py-2.5">{f.unit}</span>
              </div>
            </div>
          ))}

          {/* Daily calorie target */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500" />
              {T.dailyCalorieTarget}
            </label>
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-300">
              <input
                type="number"
                value={dailyGoalStr}
                onChange={(e) => setDailyGoalStr(e.target.value)}
                placeholder={T.goalPlaceholder}
                min={500}
                max={10000}
                className="flex-1 px-4 py-2.5 text-sm focus:outline-none"
              />
              <span className="px-3 text-xs text-slate-400 font-medium bg-slate-50 border-s border-slate-200 py-2.5">{T.kcal}</span>
            </div>
            <p className="text-[11px] text-slate-400">{T.dailyCalorieTargetHint}</p>
          </div>

          {/* Protein preview */}
          <div className={`rounded-2xl p-4 border transition-all duration-300 ${hasWeight ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-500 shrink-0" />
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">{T.proteinTitle}</p>
            </div>
            {hasWeight ? (
              <>
                <p className="text-xs text-blue-500 mb-1">
                  {T.proteinFormula(Number(weight), factor)}
                  <span className="font-black text-blue-700 text-base">{proteinGoal}g</span>
                </p>
                <p className="text-[11px] text-blue-400">{T.factorNote(Number(age) || 0)}</p>
              </>
            ) : (
              <p className="text-sm text-slate-400">{T.proteinNote}...</p>
            )}
          </div>

          {/* Buttons */}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm">
            <Save className="w-4 h-4" />
            {saving ? (lang === "he" ? "שומר..." : "Saving...") : T.save}
          </button>
          {isFirstTime && (
            <button onClick={onClose} className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">
              {T.skip}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
