import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMiFitWeightRecords, type MiFitRegion } from "@/lib/mifit";

/**
 * POST /api/integrations/mifit/sync
 *
 * Fetches weight records from the Mi Fitness / Zepp Life API for the past
 * `days` days (default 30) and upserts them into weight_log.
 *
 * Body (all optional):
 *   { days?: number, region?: "us" | "eu" | "de" | "cn" }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load stored credentials
  const { data: settings } = await supabase
    .from("user_settings")
    .select("mifit_app_token, mifit_user_id")
    .eq("user_id", user.id)
    .single();

  if (!settings?.mifit_app_token || !settings.mifit_user_id) {
    return NextResponse.json({ error: "Mi Fitness not connected" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const days   = typeof body.days   === "number" ? Math.min(Math.max(1, body.days), 365) : 30;
  const region = (typeof body.region === "string" ? body.region : "eu") as MiFitRegion;

  const toTime   = Math.floor(Date.now() / 1000);
  const fromTime = toTime - days * 86400;

  let records;
  try {
    records = await fetchMiFitWeightRecords(
      settings.mifit_app_token,
      settings.mifit_user_id,
      fromTime,
      toTime,
      region,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Mi Fitness API error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (records.length === 0) {
    return NextResponse.json({ synced: 0 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Only upsert dates up to today
  const rows = records
    .filter((r) => r.date <= today)
    .map((r) => ({ user_id: user.id, date: r.date, weight_kg: r.weight_kg }));

  if (rows.length === 0) {
    return NextResponse.json({ synced: 0 });
  }

  const { error } = await supabase
    .from("weight_log")
    .upsert(rows, { onConflict: "user_id,date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update last_sync timestamp
  await supabase
    .from("user_settings")
    .update({ mifit_last_sync: new Date().toISOString() })
    .eq("user_id", user.id);

  return NextResponse.json({ synced: rows.length });
}
