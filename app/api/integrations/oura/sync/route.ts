import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { ensureValidOuraTokens, fetchOuraDailyActivity, type OuraTokens } from "@/lib/oura";
import { buildGoalResolver, DEFAULT_DAILY_GOAL } from "@/lib/goal";

/**
 * POST /api/integrations/oura/sync
 *
 * Fetches daily total-calories from Oura for the past `days` days (default 30),
 * converts to "active extra" by subtracting that day's goal (same conversion the
 * manual "total" burn-entry mode uses), and upserts into daily_activity.
 *
 * Body (all optional): { days?: number, date?: string }
 * `date`, if provided, is echoed back in `records` when present in the synced range
 * so the caller can update its currently-viewed day without a second round-trip.
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
  const days = typeof body.days === "number" ? Math.min(Math.max(1, body.days), 365) : 30;
  const requestedDate = typeof body.date === "string" ? body.date : null;

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

  // end_date is UTC-tomorrow (not UTC-today) so users east of UTC — whose local
  // "today" is already past midnight UTC — still get Oura's data for their day.
  // Oura only ever returns real, already-elapsed days, so there's no risk of
  // fabricated future data from widening the window this way.
  const toDate = new Date(Date.now() + 86400 * 1000).toISOString().split("T")[0];
  const fromDate = new Date(Date.now() - days * 86400 * 1000).toISOString().split("T")[0];

  let records;
  try {
    records = await fetchOuraDailyActivity(tokens.accessToken, fromDate, toDate);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Oura API error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (records.length === 0) {
    return NextResponse.json({ synced: 0, records: [] });
  }

  const goalForDate = await buildGoalResolver(supabase, user.id, settings.daily_goal_calories ?? DEFAULT_DAILY_GOAL);

  const rows = records
    .map((r) => ({
      user_id: user.id,
      date: r.date,
      calories_burned: Math.max(0, r.totalCalories - goalForDate(r.date)),
      source: "oura",
    }));

  if (rows.length === 0) {
    return NextResponse.json({ synced: 0, records: [] });
  }

  const { error } = await supabase
    .from("daily_activity")
    .upsert(rows, { onConflict: "user_id,date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("user_settings")
    .update({ oura_last_sync: new Date().toISOString() })
    .eq("user_id", user.id);

  const responseRecords = rows.map((r) => ({ date: r.date, calories_burned: r.calories_burned }));
  if (requestedDate) {
    const match = responseRecords.find((r) => r.date === requestedDate);
    return NextResponse.json({ synced: rows.length, records: responseRecords, matched: match ?? null });
  }

  return NextResponse.json({ synced: rows.length, records: responseRecords });
}
