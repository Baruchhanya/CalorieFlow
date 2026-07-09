import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkEmailAccess, getAuthUser } from "@/lib/auth";
import { resolveGoalFromHistory, DEFAULT_DAILY_GOAL } from "@/lib/goal";
import { computeBalanceHistory } from "@/lib/balance";
import { fetchCriticalInitData, readProfile } from "@/lib/initData";

// Lightweight step timer for per-phase / per-step latency logging.
function makeTimer(label: string) {
  const t0 = performance.now();
  const marks: string[] = [];
  let last = t0;
  return {
    mark(name: string) {
      const now = performance.now();
      marks.push(`${name}=${Math.round(now - last)}ms`);
      last = now;
    },
    done(extra = "") {
      const total = Math.round(performance.now() - t0);
      console.log(`[perf] /api/init[${label}]: ${total}ms (${marks.join(" ")})${extra ? " " + extra : ""}`);
    },
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const phase = searchParams.get("phase") ?? "all"; // "critical" | "secondary" | "all"

  const timer = makeTimer(phase);

  const user = await getAuthUser(supabase);
  timer.mark("auth");
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const from30 = new Date(today);
  from30.setDate(from30.getDate() - 29);
  const fromStr = from30.toISOString().split("T")[0];

  // ── CRITICAL phase: only what's needed to make the main UI usable ──
  if (phase === "critical") {
    const payload = await fetchCriticalInitData(supabase, user, date);
    timer.mark("db");
    timer.done(`(date=${date})`);
    return NextResponse.json(payload);
  }

  // ── SECONDARY phase: heavier, below-the-fold data ──
  if (phase === "secondary") {
    const [settingsRes, access, histMealsRes, histActivityRes, presetsRes, suggestionsRes, acksRes, goalHistoryRes] =
      await Promise.all([
        supabase
          .from("user_settings")
          .select("daily_goal_calories")
          .eq("user_id", user.id)
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
        supabase
          .from("day_acknowledgments")
          .select("date, estimated_balance")
          .eq("user_id", user.id)
          .gte("date", fromStr)
          .lte("date", todayStr),
        supabase
          .from("goal_history")
          .select("effective_date, daily_goal_calories")
          .eq("user_id", user.id)
          .order("effective_date", { ascending: true }),
      ]);
    timer.mark("db");

    const currentGoal = settingsRes.data?.daily_goal_calories ?? DEFAULT_DAILY_GOAL;
    const goalForDate = resolveGoalFromHistory(goalHistoryRes.data ?? [], currentGoal);
    timer.mark("goal");

    const balanceHistory = computeBalanceHistory({
      meals: histMealsRes.data ?? [],
      activity: histActivityRes.data ?? [],
      acks: acksRes.data ?? [],
      goalForDate,
      from: from30,
      today,
    });
    timer.mark("balance");

    const mealSuggestions = aggregateSuggestions(suggestionsRes.data ?? []);
    timer.mark("suggestions");

    timer.done(`(date=${date})`);

    return NextResponse.json({
      is_admin: access.isAdmin,
      balance_history: balanceHistory,
      meal_presets: presetsRes.data ?? [],
      meal_suggestions: mealSuggestions,
    });
  }

  // ── ALL phase (default): full payload in one round trip ──
  const [entriesRes, settingsRes, profile, activityRes, access,
         histMealsRes, histActivityRes, presetsRes, suggestionsRes, acksRes, goalHistoryRes] =
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

      supabase
        .from("day_acknowledgments")
        .select("date, estimated_balance")
        .eq("user_id", user.id)
        .gte("date", fromStr)
        .lte("date", todayStr),

      supabase
        .from("goal_history")
        .select("effective_date, daily_goal_calories")
        .eq("user_id", user.id)
        .order("effective_date", { ascending: true }),
    ]);
  timer.mark("db");

  const currentGoal = settingsRes.data?.daily_goal_calories ?? DEFAULT_DAILY_GOAL;
  const goalForDate = resolveGoalFromHistory(goalHistoryRes.data ?? [], currentGoal);
  timer.mark("goal");
  const goalForSelectedDate = goalForDate(date);

  const balanceHistory = computeBalanceHistory({
    meals: histMealsRes.data ?? [],
    activity: histActivityRes.data ?? [],
    acks: acksRes.data ?? [],
    goalForDate,
    from: from30,
    today,
  });
  timer.mark("balance");

  const mealSuggestions = aggregateSuggestions(suggestionsRes.data ?? []);
  timer.mark("suggestions");

  timer.done(`(date=${date})`);

  return NextResponse.json({
    user: { email: user.email },
    entries: entriesRes.data ?? [],
    daily_goal_calories: goalForSelectedDate,
    current_daily_goal_calories: currentGoal,
    profile,
    calories_burned: activityRes.data?.calories_burned ?? 0,
    is_admin: access.isAdmin,
    balance_history: balanceHistory,
    meal_presets: presetsRes.data ?? [],
    meal_suggestions: mealSuggestions,
  });
}

// Aggregate meal suggestions (distinct meals by name, most recent first).
type SuggestionInput = { name?: string | null; calories?: number; protein?: number; carbs?: number; fat?: number };
type SuggestionRow = { name: string; calories: number; protein: number; carbs: number; fat: number; count: number };
function aggregateSuggestions(rows: SuggestionInput[]): SuggestionRow[] {
  const suggestionMap = new Map<string, SuggestionRow>();
  for (const row of rows) {
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
  return Array.from(suggestionMap.values()).slice(0, 18);
}
