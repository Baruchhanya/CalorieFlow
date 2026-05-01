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
  /** User-defined daily protein target (grams). null = use auto-calculated value. */
  protein_goal_g: number | null;
}

/**
 * Auto-calculate the suggested daily protein goal (grams) from body data.
 * Formula: weight_kg × 1.2 (under 60) or × 1.4 (60+), rounded to nearest 5g, min 50g.
 * Returns DEFAULT_TARGETS.protein when weight is missing.
 *
 * NOTE: This is the *suggested* value. To get the *effective* value the user
 * sees on the dashboard, call `effectiveProteinGoal(profile)` which honors a
 * manual override stored in `profile.protein_goal_g`.
 */
export function calcProteinGoal(
  profile: Pick<UserProfile, "weight_kg" | "age"> | null
): number {
  if (!profile?.weight_kg) return DEFAULT_TARGETS.protein;
  const factor = (profile.age ?? 0) >= 60 ? 1.4 : 1.2;
  const raw = profile.weight_kg * factor;
  return Math.max(50, Math.round(raw / 5) * 5);
}

/**
 * The protein goal actually shown to the user. Honors a manual override
 * (`profile.protein_goal_g`) when set; otherwise falls back to the
 * auto-calculated value.
 */
export function effectiveProteinGoal(profile: UserProfile | null): number {
  if (profile?.protein_goal_g && profile.protein_goal_g > 0) {
    return profile.protein_goal_g;
  }
  return calcProteinGoal(profile);
}
