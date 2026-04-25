import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkEmailAccess } from "@/lib/auth";

/**
 * GET /api/init?date=YYYY-MM-DD
 *
 * Single endpoint that replaces 4 separate fetches on page load:
 *   /api/settings, /api/profile, /api/entries?date=, /api/activity?date=
 *
 * Auth is verified once; all queries run in parallel via Promise.all.
 * Also returns the caller's admin status so the UI can hide/show
 * the Admin entry point without a second round-trip.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const [entriesRes, settingsRes, profileRes, activityRes, access] =
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

      supabase
        .from("user_profile")
        .select("height_cm, weight_kg, age")
        .eq("user_id", user.id)
        .single(),

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
    profile: profileRes.data ?? null,
    calories_burned: activityRes.data?.calories_burned ?? 0,
    is_admin: access.isAdmin,
  });
}
