import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ensureValidOuraTokens, fetchOuraDailyActivity, type OuraTokens } from "@/lib/oura";
import { buildGoalResolver, DEFAULT_DAILY_GOAL } from "@/lib/goal";

/**
 * GET /api/cron/oura-sync
 *
 * Runs twice daily (see vercel.json). Pulls today's total-calories from Oura for
 * every user with a connected account, converts to "active extra" by subtracting
 * that day's goal, and upserts only today into daily_activity.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  if (!serviceKey || !supabaseUrl || !clientId || !clientSecret) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: accounts, error } = await supabaseAdmin
    .from("user_settings")
    .select("user_id, oura_access_token, oura_refresh_token, oura_token_expires_at, daily_goal_calories")
    .not("oura_access_token", "is", null)
    .not("oura_refresh_token", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const today = new Date().toISOString().split("T")[0];

  const results = [];

  for (const account of accounts ?? []) {
    try {
      const currentTokens: OuraTokens = {
        accessToken:  account.oura_access_token,
        refreshToken: account.oura_refresh_token,
        expiresAt:    account.oura_token_expires_at,
      };

      const { tokens, refreshed } = await ensureValidOuraTokens(clientId, clientSecret, currentTokens);

      if (refreshed) {
        await supabaseAdmin
          .from("user_settings")
          .update({
            oura_access_token: tokens.accessToken,
            oura_refresh_token: tokens.refreshToken,
            oura_token_expires_at: tokens.expiresAt,
          })
          .eq("user_id", account.user_id);
      }

      const records = await fetchOuraDailyActivity(tokens.accessToken, today, today);
      const record = records.find((r) => r.date === today);

      if (record) {
        const goalForDate = await buildGoalResolver(
          supabaseAdmin,
          account.user_id,
          account.daily_goal_calories ?? DEFAULT_DAILY_GOAL,
        );

        const { error: upsertError } = await supabaseAdmin
          .from("daily_activity")
          .upsert(
            {
              user_id: account.user_id,
              date: record.date,
              calories_burned: Math.max(0, record.totalCalories - goalForDate(record.date)),
              source: "oura",
            },
            { onConflict: "user_id,date" },
          );
        if (upsertError) throw new Error(upsertError.message);

        await supabaseAdmin
          .from("user_settings")
          .update({ oura_last_sync: new Date().toISOString() })
          .eq("user_id", account.user_id);
      }

      results.push({ user_id: account.user_id, synced: record ? 1 : 0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Oura sync error";
      results.push({ user_id: account.user_id, error: msg });
    }
  }

  return NextResponse.json({ ok: true, count: results.length, results });
}
