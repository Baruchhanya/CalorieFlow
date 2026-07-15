import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { fetchMiFitWeightRecords } from "@/lib/mifit";

/**
 * GET /api/cron/mifit-sync
 *
 * Runs twice daily (see vercel.json). Pulls recent weight records from
 * Mi Fitness / Zepp for every user with a connected account and upserts
 * them into weight_log.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: accounts, error } = await supabaseAdmin
    .from("user_settings")
    .select("user_id, mifit_app_token, mifit_user_id")
    .not("mifit_app_token", "is", null)
    .not("mifit_user_id", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const toTime = Math.floor(Date.now() / 1000);
  const fromTime = toTime - 3 * 86400; // 3-day lookback covers a missed run
  const today = new Date().toISOString().split("T")[0];

  const results = [];

  for (const account of accounts ?? []) {
    try {
      const records = await fetchMiFitWeightRecords(
        account.mifit_app_token,
        account.mifit_user_id,
        fromTime,
        toTime,
        "us",
      );

      const rows = records
        .filter((r) => r.date <= today)
        .map((r) => ({ user_id: account.user_id, date: r.date, weight_kg: r.weight_kg, source: "mifit" }));

      if (rows.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from("weight_log")
          .upsert(rows, { onConflict: "user_id,date" });
        if (upsertError) throw new Error(upsertError.message);
      }

      await supabaseAdmin
        .from("user_settings")
        .update({ mifit_last_sync: new Date().toISOString() })
        .eq("user_id", account.user_id);

      results.push({ user_id: account.user_id, synced: rows.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Mi Fitness sync error";
      results.push({ user_id: account.user_id, error: msg });
    }
  }

  return NextResponse.json({ ok: true, count: results.length, results });
}
