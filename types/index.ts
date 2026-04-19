export interface FoodItem {
  name: string;
  quantity: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface GeminiResponse {
  items: FoodItem[];
  total_calories: number;
  needs_clarification: boolean;
  note: string;
}

/** Shape returned by Supabase (snake_case) */
export interface MealEntry {
  id: string;
  user_id: string;
  date: string;           // YYYY-MM-DD
  name: string;
  quantity: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  note: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const DEFAULT_TARGETS: DailyTotals = {
  calories: 1820,
  protein: 150,
  carbs: 250,
  fat: 65,
};

export interface UserSettings {
  user_id: string;
  daily_goal_calories: number;
}

/** Saved recurring meal template (quick-add). */
export interface MealPreset {
  id: string;
  user_id: string;
  name: string;
  quantity: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sort_order: number;
  created_at: string;
  updated_at?: string | null;
}

export interface DailyActivity {
  id: string;
  user_id: string;
  date: string;
  calories_burned: number;
}

export interface UserProfile {
  height_cm: number | null;
  weight_kg: number | null;
  age: number | null;
}

/**
 * Calculate daily protein goal (grams) based on personal data.
 * Formula: weight_kg × 1.2 (under 60) or × 1.4 (60+), rounded to nearest 5g.
 * Falls back to DEFAULT_TARGETS.protein if data is missing.
 */
export function calcProteinGoal(profile: UserProfile | null): number {
  if (!profile?.weight_kg) return DEFAULT_TARGETS.protein;
  const factor = (profile.age ?? 0) >= 60 ? 1.4 : 1.2;
  const raw = profile.weight_kg * factor;
  return Math.max(50, Math.round(raw / 5) * 5);
}
