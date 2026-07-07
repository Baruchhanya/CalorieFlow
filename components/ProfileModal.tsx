"use client";

import { useState, useEffect } from "react";
import { X, User, Save, Ruler, Weight, Calendar, Info, Flame, Beef } from "lucide-react";
import { UserProfile, calcProteinGoal } from "@/types";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";
import Modal from "@/components/ui/Modal";

function localTodayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

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
  const [proteinGoalStr, setProteinGoalStr] = useState(
    initialProfile?.protein_goal_g ? String(initialProfile.protein_goal_g) : ""
  );
  const [dailyGoalStr, setDailyGoalStr] = useState(String(dailyGoalCalories));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDailyGoalStr(String(dailyGoalCalories));
  }, [dailyGoalCalories]);

  // Auto-calculated suggestion based on current body data
  const autoProteinGoal = calcProteinGoal({
    weight_kg: Number(weight) || null,
    age: Number(age) || null,
  });
  const manualProteinNum = Number(proteinGoalStr);
  const usingManual =
    proteinGoalStr.trim() !== "" &&
    Number.isFinite(manualProteinNum) &&
    manualProteinNum > 0;
  const effectiveProtein = usingManual ? manualProteinNum : autoProteinGoal;

  const profileT = lang === "he" ? {
    title: isFirstTime ? "ברוך הבא! הגדר את הפרופיל שלך" : "פרופיל אישי",
    subtitle: isFirstTime ? "כדי לחשב את יעד החלבון שלך" : "עדכן את הפרטים שלך",
    height: "גובה (ס״מ)",
    weight: "משקל (ק״ג)",
    age: "גיל",
    proteinGoalLabel: "יעד חלבון יומי",
    proteinPlaceholder: (auto: number) => `אוטומטי: ${auto}`,
    proteinHintAuto: (auto: number) => `מומלץ ${auto} גרם לפי המשקל שלך. השאר ריק לחישוב אוטומטי.`,
    proteinHintManual: (manual: number, auto: number) =>
      `יעד מותאם אישית: ${manual} גרם (אוטומטי היה ${auto}). מחק את התוכן לחישוב אוטומטי.`,
    proteinTitle: "יעד החלבון שלך",
    proteinNote: "יחושב אוטומטית לפי משקלך",
    save: "שמור פרופיל",
    skip: "דלג בינתיים",
    errorWeight: "משקל לא תקין (20-300)",
    errorAge: "גיל לא תקין (10-120)",
    errorProtein: "יעד חלבון לא תקין (10-500 גרם)",
    heightPlaceholder: "לדוג׳ 175",
    weightPlaceholder: "לדוג׳ 75",
    agePlaceholder: "לדוג׳ 30",
    factorNote: (age: number) => age >= 60 ? "(מבוגר מעל 60: ×1.4)" : "(×1.2 לאדם צעיר)",
    errorCalorieGoal: "יעד קלורי לא תקין (500–10,000)",
    badgeAuto: "אוטומטי",
    badgeManual: "מותאם אישית",
  } : {
    title: isFirstTime ? "Welcome! Set up your profile" : "Personal Profile",
    subtitle: isFirstTime ? "To calculate your daily protein goal" : "Update your details",
    height: "Height (cm)",
    weight: "Weight (kg)",
    age: "Age",
    proteinGoalLabel: "Daily protein goal",
    proteinPlaceholder: (auto: number) => `Auto: ${auto}`,
    proteinHintAuto: (auto: number) => `Suggested ${auto}g based on your weight. Leave blank for auto.`,
    proteinHintManual: (manual: number, auto: number) =>
      `Custom: ${manual}g (auto was ${auto}g). Clear the field to revert to auto.`,
    proteinTitle: "Your protein goal",
    proteinNote: "Will be calculated from your weight",
    save: "Save Profile",
    skip: "Skip for now",
    errorWeight: "Invalid weight (20-300)",
    errorAge: "Invalid age (10-120)",
    errorProtein: "Invalid protein goal (10-500g)",
    heightPlaceholder: "e.g. 175",
    weightPlaceholder: "e.g. 75",
    agePlaceholder: "e.g. 30",
    factorNote: (age: number) => age >= 60 ? "(60+: ×1.4 for muscle preservation)" : "(×1.2 standard)",
    errorCalorieGoal: "Invalid calorie goal (500–10,000)",
    badgeAuto: "Auto",
    badgeManual: "Custom",
  };
  const T = { ...gT, ...profileT };

  const handleSave = async () => {
    const w = Number(weight);
    const a = Number(age);
    const g = Number(dailyGoalStr);
    if (weight && (w < 20 || w > 300)) { setError(T.errorWeight); return; }
    if (age && (a < 10 || a > 120)) { setError(T.errorAge); return; }
    if (proteinGoalStr.trim() !== "") {
      const p = Number(proteinGoalStr);
      if (!Number.isFinite(p) || p < 10 || p > 500) {
        setError(T.errorProtein);
        return;
      }
    }
    if (dailyGoalStr.trim() !== "" && (Number.isNaN(g) || g < 500 || g > 10000)) {
      setError(T.errorCalorieGoal);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const protein_goal_g =
        proteinGoalStr.trim() === "" ? null : Math.round(Number(proteinGoalStr));
      const profile: UserProfile = {
        height_cm: Number(height) || null,
        weight_kg: w || null,
        age: a || null,
        protein_goal_g,
      };
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      // If the migration hasn't run yet, the API silently drops protein_goal_g.
      // Reflect what the API actually persisted (if returned) so the UI is honest.
      let persisted: UserProfile = profile;
      if (res.ok) {
        try {
          const data = await res.json();
          if (data && typeof data === "object") {
            persisted = {
              height_cm: data.height_cm ?? null,
              weight_kg: data.weight_kg ?? null,
              age: data.age ?? null,
              protein_goal_g: data.protein_goal_g ?? null,
            };
          }
        } catch {}
      }

      if (dailyGoalStr.trim() !== "" && !Number.isNaN(g) && g >= 500 && g <= 10000) {
        const sRes = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ daily_goal_calories: g, today_date: localTodayStr() }),
        });
        if (sRes.ok) onDailyGoalSaved?.(g);
        else showToast(T.saveError, "error");
      }
      showToast(lang === "he" ? "הפרופיל נשמר" : "Profile saved", "success");
      onSave(persisted);
    } finally {
      setSaving(false);
    }
  };

  const factor = (Number(age) || 0) >= 60 ? 1.4 : 1.2;
  const hasWeight = Boolean(weight && Number(weight) > 0);

  const fieldWrapCls =
    "flex items-center border border-line rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-brand-500/40";
  const unitCls = "px-3 text-xs text-ink-3 font-medium bg-canvas border-s border-line py-2.5";

  return (
    <Modal open onClose={onClose} closeDisabled={saving} maxWidthClass="sm:max-w-sm">
      {/* Brand header */}
      <div className="bg-brand-700 px-6 py-5 text-white relative sticky top-0 z-10">
        <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center mb-3">
          <User className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold leading-tight">{T.title}</h2>
        <p className="text-brand-100/90 text-sm mt-1">{T.subtitle}</p>
        {!isFirstTime && (
          <button onClick={onClose} className="absolute top-4 end-4 p-1.5 rounded-xl bg-white/15 hover:bg-white/25 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-6 flex flex-col gap-4">
        {error && (
          <div className="bg-over/10 border border-over/20 rounded-xl px-3 py-2 text-sm text-over">{error}</div>
        )}

        {[
          { icon: <Ruler className="w-4 h-4 text-ink-3" />, label: T.height, val: height, set: setHeight, placeholder: T.heightPlaceholder, unit: "cm" },
          { icon: <Weight className="w-4 h-4 text-brand-600" />, label: T.weight, val: weight, set: setWeight, placeholder: T.weightPlaceholder, unit: "kg" },
          { icon: <Calendar className="w-4 h-4 text-ink-3" />, label: T.age, val: age, set: setAge, placeholder: T.agePlaceholder, unit: lang === "he" ? "שנים" : "years" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide flex items-center gap-1.5">
              {f.icon}{f.label}
            </label>
            <div className={fieldWrapCls}>
              <input
                type="number"
                inputMode="numeric"
                value={f.val}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.placeholder}
                min={0}
                className="flex-1 px-4 py-2.5 text-sm tabular-nums focus:outline-none"
              />
              <span className={unitCls}>{f.unit}</span>
            </div>
          </div>
        ))}

        {/* Daily protein goal (editable, with auto fallback) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide flex items-center gap-1.5">
            <Beef className="w-4 h-4 text-protein" />
            {T.proteinGoalLabel}
            <span className={`ms-auto inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              usingManual ? "bg-protein/10 text-protein" : "bg-canvas text-ink-3 border border-line"
            }`}>
              {usingManual ? T.badgeManual : T.badgeAuto}
            </span>
          </label>
          <div className={fieldWrapCls}>
            <input
              type="number"
              inputMode="numeric"
              value={proteinGoalStr}
              onChange={(e) => setProteinGoalStr(e.target.value)}
              placeholder={T.proteinPlaceholder(autoProteinGoal)}
              min={10}
              max={500}
              className="flex-1 px-4 py-2.5 text-sm tabular-nums focus:outline-none"
            />
            <span className={unitCls}>g</span>
          </div>
          <p className="text-[11px] text-ink-3">
            {usingManual
              ? T.proteinHintManual(manualProteinNum, autoProteinGoal)
              : T.proteinHintAuto(autoProteinGoal)}
          </p>
        </div>

        {/* Daily calorie target */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-fat" />
            {T.dailyCalorieTarget}
          </label>
          <div className={fieldWrapCls}>
            <input
              type="number"
              inputMode="numeric"
              value={dailyGoalStr}
              onChange={(e) => setDailyGoalStr(e.target.value)}
              placeholder={T.goalPlaceholder}
              min={500}
              max={10000}
              className="flex-1 px-4 py-2.5 text-sm tabular-nums focus:outline-none"
            />
            <span className={unitCls}>{T.kcal}</span>
          </div>
          <p className="text-[11px] text-ink-3">{T.dailyCalorieTargetHint}</p>
        </div>

        {/* Protein preview / summary */}
        <div className={`rounded-xl p-4 border transition-all duration-300 ${hasWeight || usingManual ? "bg-brand-50 border-brand-100" : "bg-canvas border-line"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-brand-600 shrink-0" />
            <p className="text-[11px] font-semibold text-brand-700 uppercase tracking-wide">{T.proteinTitle}</p>
          </div>
          {hasWeight || usingManual ? (
            <>
              <p className="text-xs text-ink-2 mb-1 tabular-nums">
                {usingManual ? (
                  <span className="font-bold text-brand-700 text-base">{Math.round(effectiveProtein)}g</span>
                ) : (
                  <>
                    {Number(weight)} {lang === "he" ? "ק״ג" : "kg"} × {factor} ={" "}
                    <span className="font-bold text-brand-700 text-base">{Math.round(effectiveProtein)}g</span>
                  </>
                )}
              </p>
              {!usingManual && (
                <p className="text-[11px] text-ink-3">{T.factorNote(Number(age) || 0)}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-3">{T.proteinNote}...</p>
          )}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-700 transition-colors disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? (lang === "he" ? "שומר..." : "Saving...") : T.save}
        </button>
        {isFirstTime && (
          <button onClick={onClose} className="w-full py-2 text-sm text-ink-3 hover:text-ink-2 transition-colors">
            {T.skip}
          </button>
        )}
        {/* Safe-area spacer for iPhone home indicator */}
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>
    </Modal>
  );
}
