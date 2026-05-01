import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkEmailAccess } from "@/lib/auth";

/**
 * Read user_profile, gracefully falling back if the optional
 * `protein_goal_g` column doesn't exist yet (pre-migration deploy).
 */
async function readProfile(supabase: SupabaseClient, userId: string) {
  const tryFull = await supabase
    .from("user_profile")
    .select("height_cm, weight_kg, age, protein_goal_g")
    .eq("user_id", userId)
    .single();
  if (!tryFull.error) return tryFull.data;

  const msg = (tryFull.error.message || "").toLowerCase();
  if (msg.includes("protein_goal_g") || msg.includes("does not exist") || msg.includes("column")) {
    const legacy = await supabase
      .from("user_profile")
      .select("height_cm, weight_kg, age")
      .eq("user_id", userId)
      .single();
    if (!legacy.error && legacy.data) {
      return { ...legacy.data, protein_goal_g: null };
    }
  }
  return null;
}

/**
 * GET /api/init?date=YYYY-MM-DD
 *
 * Single endpoint that replaces 4 separate fetches on page load:
 *   /api/settings, /api/profile, /api/entries?date=, /api/activity?date=
 *
 * Auth is verified once; queries run in parallel via Promise.all.
 * Also returns the caller's admin status so the UI can hide/show
 * the Admin entry point without a second round-trip.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const [entriesRes, settingsRes, profile, activityRes, access] =
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
    ]);

  return NextResponse.json({
    user: { email: user.email },
    entries: entriesRes.data ?? [],
    daily_goal_calories: settingsRes.data?.daily_goal_calories ?? 1820,
    profile,
    calories_burned: activityRes.data?.calories_burned ?? 0,
    is_admin: access.isAdmin,
  });
}
