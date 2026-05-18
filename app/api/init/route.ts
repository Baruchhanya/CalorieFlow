import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkEmailAccess } from "@/lib/auth";
import type { BalanceDay, BalanceHistoryResponse } from "@/app/api/balance-history/route";

async function readProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_profile")
    .select("height_cm, weight_kg, age, protein_goal_g")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const from30 = new Date(today);
  from30.setDate(from30.getDate() - 29);
  const fromStr = from30.toISOString().split("T")[0];

  const [entriesRes, settingsRes, profile, activityRes, access,
         histMealsRes, histActivityRes, presetsRes, suggestionsRes] =
    await Promise.all([
      supabase
        .from("meals")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", date)
        .order("created_at", { ascending: true }),

      supabase
        .from("user_settings")
        .select("daily_goal_calories")
        .eq("user_id", user.id)
        .single(),

      readProfile(supabase, user.id),

      supabase
        .from("daily_activity")
        .select("calories_burned")
        .eq("user_id", user.id)
        .eq("date", date)
        .single(),

      checkEmailAccess(user.email, supabase),

      supabase
        .from("meals")
        .select("date, calories")
        .eq("user_id", user.id)
        .gte("date", fromStr)
        .lte("date", todayStr),

      supabase
        .from("daily_activity")
        .select("date, calories_burned")
        .eq("user_id", user.id)
        .gte("date", fromStr)
        .lte("date", todayStr),

      supabase
        .from("meal_presets")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),

      supabase
        .from("meals")
        .select("name, calories, protein, carbs, fat, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

  const goal = settingsRes.data?.daily_goal_calories ?? 1820;

  // Build balance history (same logic as /api/balance-history)
  const calorieMap = new Map<string, number>();
  for (const m of histMealsRes.data ?? []) {
    calorieMap.set(m.date, (calorieMap.get(m.date) ?? 0) + (m.calories ?? 0));
  }
  const activityMap = new Map<string, number>();
  for (const a of histActivityRes.data ?? []) {
    activityMap.set(a.date, a.calories_burned ?? 0);
  }

  const allDays: BalanceDay[] = [];
  const cur = new Date(from30);
  while (cur < today) {
    const dateStr = cur.toISOString().split("T")[0];
    if (dateStr !== todayStr) {
      const consumed = calorieMap.get(dateStr);
      if (consumed !== undefined) {
        const burned = activityMap.get(dateStr) ?? 0;
        allDays.push({ date: dateStr, balance: Math.round((consumed - burned) - goal) });
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  const days7 = allDays.slice(-7);
  const weeklySum = days7.reduce((s, d) => s + d.balance, 0);
  const monthlySum = allDays.reduce((s, d) => s + d.balance, 0);

  const balanceHistory: BalanceHistoryResponse = {
    days7,
    weekly_avg: days7.length > 0 ? Math.round(weeklySum / days7.length) : null,
    weekly_total: days7.length > 0 ? Math.round(weeklySum) : null,
    monthly_avg: allDays.length > 0 ? Math.round(monthlySum / allDays.length) : null,
    monthly_total: allDays.length > 0 ? Math.round(monthlySum) : null,
  };

  // Aggregate meal suggestions (distinct meals by name, most recent first)
  type SuggestionRow = { name: string; calories: number; protein: number; carbs: number; fat: number; count: number };
  const suggestionMap = new Map<string, SuggestionRow>();
  for (const row of suggestionsRes.data ?? []) {
    const raw = row.name?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const existing = suggestionMap.get(key);
    if (!existing) {
      suggestionMap.set(key, {
        name: raw,
        calories: Number(row.calories) || 0,
        protein: Number(row.protein) || 0,
        carbs: Number(row.carbs) || 0,
        fat: Number(row.fat) || 0,
        count: 1,
      });
    } else {
      existing.count += 1;
    }
  }
  const mealSuggestions = Array.from(suggestionMap.values()).slice(0, 18);

  return NextResponse.json({
    user: { email: user.email },
    entries: entriesRes.data ?? [],
    daily_goal_calories: goal,
    profile,
    calories_burned: activityRes.data?.calories_burned ?? 0,
    is_admin: access.isAdmin,
    balance_history: balanceHistory,
    meal_presets: presetsRes.data ?? [],
    meal_suggestions: mealSuggestions,
  });
}
