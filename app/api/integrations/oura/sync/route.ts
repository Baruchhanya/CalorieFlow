import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { ensureValidOuraTokens, fetchOuraDailyActivity, type OuraTokens } from "@/lib/oura";
import { buildGoalResolver, DEFAULT_DAILY_GOAL } from "@/lib/goal";

/**
 * POST /api/integrations/oura/sync
 *
 * Fetches Oura total-calories for a single day, converts to "active extra" by
 * subtracting that day's goal (same conversion the manual "total" burn-entry
 * mode uses), and upserts only that day into daily_activity.
 *
 * Body: { date: string } — YYYY-MM-DD of the currently-viewed day.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Oura integration not configured" }, { status: 500 });
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("oura_access_token, oura_refresh_token, oura_token_expires_at, daily_goal_calories")
    .eq("user_id", user.id)
    .single();

  if (!settings?.oura_access_token || !settings.oura_refresh_token || !settings.oura_token_expires_at) {
    return NextResponse.json({ error: "Oura not connected" }, { status: 400 });
  }

  const currentTokens: OuraTokens = {
    accessToken:  settings.oura_access_token,
    refreshToken: settings.oura_refresh_token,
    expiresAt:    settings.oura_token_expires_at,
  };

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const requestedDate = typeof body.date === "string" ? body.date : null;
  if (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
  }

  let tokens: OuraTokens;
  let refreshed: boolean;
  try {
    ({ tokens, refreshed } = await ensureValidOuraTokens(clientId, clientSecret, currentTokens));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Oura token refresh failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (refreshed) {
    await supabase
      .from("user_settings")
      .update({
        oura_access_token: tokens.accessToken,
        oura_refresh_token: tokens.refreshToken,
        oura_token_expires_at: tokens.expiresAt,
      })
      .eq("user_id", user.id);
  }

  // Query a day of padding on each side of the requested date — guards against
  // any inclusive/exclusive edge on Oura's end, without changing what we store
  // (we still only ever match and upsert the exact requestedDate below).
  const anchor = new Date(requestedDate + "T12:00:00");
  const fromDate = new Date(anchor.getTime() - 86400 * 1000).toISOString().split("T")[0];
  const toDate = new Date(anchor.getTime() + 86400 * 1000).toISOString().split("T")[0];

  let records;
  try {
    records = await fetchOuraDailyActivity(tokens.accessToken, fromDate, toDate);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Oura API error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const record = records.find((r) => r.date === requestedDate);
  if (!record) {
    return NextResponse.json({ synced: 0, matched: null });
  }

  const goalForDate = await buildGoalResolver(supabase, user.id, settings.daily_goal_calories ?? DEFAULT_DAILY_GOAL);
  const caloriesBurned = Math.max(0, record.totalCalories - goalForDate(record.date));
  const row = {
    user_id: user.id,
    date: record.date,
    calories_burned: caloriesBurned,
    source: "oura",
  };

  const { error } = await supabase
    .from("daily_activity")
    .upsert(row, { onConflict: "user_id,date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("user_settings")
    .update({ oura_last_sync: new Date().toISOString() })
    .eq("user_id", user.id);

  return NextResponse.json({
    synced: 1,
    matched: { date: row.date, calories_burned: caloriesBurned },
  });
}
