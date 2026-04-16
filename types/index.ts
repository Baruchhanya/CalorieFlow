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
  calories: 2000,
  protein: 150,
  carbs: 250,
  fat: 65,
};
