import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkEmailAccess, createServiceRoleClient, getAuthUser } from "@/lib/auth";
import { estimateUsageCost } from "@/lib/gemini";

export interface UserStat {
  user_id: string | null;
  email: string;
  // account / auth
  joined_at: string | null;
  last_sign_in: string | null;
  // meals
  meals_total: number;
  meals_30d: number;
  meals_7d: number;
  days_tracked: number;
  last_meal_at: string | null;
  // gemini
  gemini_calls_total: number;
  gemini_calls_30d: number;
  gemini_calls_7d: number;
  gemini_tokens_30d: number;
  gemini_cost_usd_30d: number;
  gemini_cost_usd_total: number;
  gemini_errors_30d: number;
  last_gemini_at: string | null;
}

export interface GlobalStats {
  gemini_calls_today: number;
  gemini_calls_7d: number;
  gemini_calls_30d: number;
  gemini_calls_total: number;
  gemini_cost_usd_today: number;
  gemini_cost_usd_30d: number;
  gemini_cost_usd_total: number;
  gemini_errors_30d: number;
  gemini_avg_duration_ms_30d: number | null;
}

export interface AdminStatsResponse {
  generated_at: string;
  global: GlobalStats;
  users: UserStat[];
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

interface MealRow {
  user_id: string | null;
  date: string | null;
  created_at: string;
}

interface GeminiRow {
  user_id: string | null;
  user_email: string | null;
  status: string;
  prompt_tokens: number | null;
  candidates_tokens: number | null;
  total_tokens: number | null;
  duration_ms: number | null;
  created_at: string;
}

interface AuthUser {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
}

interface AllowedRow {
  email: string;
}

export async function GET() {
  const t0 = performance.now();
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await checkEmailAccess(user.email, supabase);
  if (!access.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createServiceRoleClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const now = new Date();
  const start30d = isoDaysAgo(30);
  const start7d = isoDaysAgo(7);
  const startToday = startOfTodayIso();

  // Fetch in parallel: meals, gemini_usage, allowed_users, auth users
  const [mealsRes, geminiRes, allowedRes, authRes] = await Promise.all([
    admin.from("meals").select("user_id, date, created_at"),
    admin.from("gemini_usage").select("user_id, user_email, status, prompt_tokens, candidates_tokens, total_tokens, duration_ms, created_at"),
    admin.from("allowed_users").select("email"),
    fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=200`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    }).then((r) => (r.ok ? r.json() : { users: [] })),
  ]);

  const meals = (mealsRes.data ?? []) as MealRow[];
  const gemini = (geminiRes.data ?? []) as GeminiRow[];
  const allowed = (allowedRes.data ?? []) as AllowedRow[];
  const authUsers = ((authRes as { users?: AuthUser[] })?.users ?? []) as AuthUser[];

  // Build set of all users we want to display: union of auth users + allowed_users emails
  // (allowed users may not have signed in yet → no auth row)
  type Row = { user_id: string | null; email: string; joined_at: string | null; last_sign_in: string | null };
  const byEmail = new Map<string, Row>();

  for (const u of authUsers) {
    const e = (u.email ?? "").toLowerCase();
    if (!e) continue;
    byEmail.set(e, {
      user_id: u.id,
      email: e,
      joined_at: u.created_at ?? null,
      last_sign_in: u.last_sign_in_at ?? null,
    });
  }
  for (const a of allowed) {
    const e = a.email.toLowerCase();
    if (!byEmail.has(e)) {
      byEmail.set(e, { user_id: null, email: e, joined_at: null, last_sign_in: null });
    }
  }

  // Precompute each gemini row's cost once (was computed twice per user before).
  const gemCost = new Map<GeminiRow, number>();
  for (const g of gemini) {
    gemCost.set(
      g,
      estimateUsageCost({
        promptTokens: g.prompt_tokens ?? 0,
        candidatesTokens: g.candidates_tokens ?? 0,
        totalTokens: g.total_tokens ?? 0,
      })
    );
  }

  // Group rows by owner in single passes (was O(users × rows) of repeated filters).
  const mealsByUser = new Map<string, MealRow[]>();
  for (const m of meals) {
    if (!m.user_id) continue;
    const arr = mealsByUser.get(m.user_id);
    if (arr) arr.push(m);
    else mealsByUser.set(m.user_id, [m]);
  }
  // Gemini rows are attributed by user_id when present, else by lowercased email.
  const gemByUserId = new Map<string, GeminiRow[]>();
  const gemByEmail = new Map<string, GeminiRow[]>();
  for (const g of gemini) {
    if (g.user_id) {
      const arr = gemByUserId.get(g.user_id);
      if (arr) arr.push(g);
      else gemByUserId.set(g.user_id, [g]);
    } else if (g.user_email) {
      const key = g.user_email.toLowerCase();
      const arr = gemByEmail.get(key);
      if (arr) arr.push(g);
      else gemByEmail.set(key, [g]);
    }
  }

  // Per-user aggregates
  const userStats: UserStat[] = Array.from(byEmail.values()).map((r) => {
    const userMeals = r.user_id ? mealsByUser.get(r.user_id) ?? [] : [];
    const userGem = r.user_id
      ? gemByUserId.get(r.user_id) ?? []
      : gemByEmail.get(r.email) ?? [];

    let meals_30d = 0, meals_7d = 0;
    let last_meal_at: string | null = null;
    const daySet = new Set<string>();
    for (const m of userMeals) {
      if (m.created_at >= start30d) meals_30d++;
      if (m.created_at >= start7d) meals_7d++;
      if (m.date) daySet.add(m.date);
      if (last_meal_at === null || m.created_at > last_meal_at) last_meal_at = m.created_at;
    }
    const days_tracked = daySet.size;

    let gemini_calls_30d = 0, gemini_calls_7d = 0;
    let tokens_30d = 0, cost_30d = 0, cost_total = 0, errors_30d = 0;
    let last_gemini_at: string | null = null;
    for (const g of userGem) {
      const c = gemCost.get(g) ?? 0;
      cost_total += c;
      if (g.created_at >= start30d) {
        gemini_calls_30d++;
        tokens_30d += g.total_tokens ?? 0;
        cost_30d += c;
        if (g.status !== "success") errors_30d++;
      }
      if (g.created_at >= start7d) gemini_calls_7d++;
      if (last_gemini_at === null || g.created_at > last_gemini_at) last_gemini_at = g.created_at;
    }

    return {
      user_id: r.user_id,
      email: r.email,
      joined_at: r.joined_at,
      last_sign_in: r.last_sign_in,
      meals_total: userMeals.length,
      meals_30d,
      meals_7d,
      days_tracked,
      last_meal_at,
      gemini_calls_total: userGem.length,
      gemini_calls_30d,
      gemini_calls_7d,
      gemini_tokens_30d: tokens_30d,
      gemini_cost_usd_30d: cost_30d,
      gemini_cost_usd_total: cost_total,
      gemini_errors_30d: errors_30d,
      last_gemini_at,
    };
  });

  // Sort by recent activity (last_gemini_at OR last_meal_at)
  userStats.sort((a, b) => {
    const aT = a.last_gemini_at ?? a.last_meal_at ?? "";
    const bT = b.last_gemini_at ?? b.last_meal_at ?? "";
    return bT.localeCompare(aT);
  });

  // Global rollups
  const gem_today = gemini.filter((g) => g.created_at >= startToday);
  const gem_g_7d = gemini.filter((g) => g.created_at >= start7d);
  const gem_g_30d = gemini.filter((g) => g.created_at >= start30d);

  const sumCost = (rows: GeminiRow[]) =>
    rows.reduce((s, g) => s + (gemCost.get(g) ?? 0), 0);

  const durations = gem_g_30d.map((g) => g.duration_ms ?? 0).filter((d) => d > 0);
  const avg_dur = durations.length === 0 ? null : Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);

  const payload: AdminStatsResponse = {
    generated_at: now.toISOString(),
    global: {
      gemini_calls_today: gem_today.length,
      gemini_calls_7d: gem_g_7d.length,
      gemini_calls_30d: gem_g_30d.length,
      gemini_calls_total: gemini.length,
      gemini_cost_usd_today: sumCost(gem_today),
      gemini_cost_usd_30d: sumCost(gem_g_30d),
      gemini_cost_usd_total: sumCost(gemini),
      gemini_errors_30d: gem_g_30d.filter((g) => g.status !== "success").length,
      gemini_avg_duration_ms_30d: avg_dur,
    },
    users: userStats,
  };

  console.log(`[perf] /api/admin/stats: ${Math.round(performance.now() - t0)}ms (users=${userStats.length}, meals=${meals.length}, gemini=${gemini.length})`);

  return NextResponse.json(payload);
}
