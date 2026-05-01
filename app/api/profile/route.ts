import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const FULL_COLS = "height_cm, weight_kg, age, protein_goal_g";
const BASE_COLS = "height_cm, weight_kg, age";

/**
 * Try to read the profile with the new `protein_goal_g` column. If that
 * column doesn't exist yet (migration not run), gracefully fall back to the
 * legacy column set so the app keeps working.
 */
async function readProfile(supabase: SupabaseClient, userId: string) {
  const tryFull = await supabase
    .from("user_profile")
    .select(FULL_COLS)
    .eq("user_id", userId)
    .single();

  if (!tryFull.error) return tryFull.data;

  // Fall back if the new column isn't there yet
  const msg = (tryFull.error.message || "").toLowerCase();
  if (msg.includes("protein_goal_g") || msg.includes("does not exist") || msg.includes("column")) {
    const legacy = await supabase
      .from("user_profile")
      .select(BASE_COLS)
      .eq("user_id", userId)
      .single();
    if (!legacy.error && legacy.data) {
      return { ...legacy.data, protein_goal_g: null };
    }
  }
  return null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await readProfile(supabase, user.id);
  return NextResponse.json(data ?? null);
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const height_cm = body.height_cm ? Number(body.height_cm) : null;
  const weight_kg = body.weight_kg ? Number(body.weight_kg) : null;
  const age = body.age ? Number(body.age) : null;

  // Optional protein override; treat any non-positive / out-of-range as a
  // request to clear back to the auto-calculated value.
  let protein_goal_g: number | null = null;
  const rawProtein = body.protein_goal_g;
  if (rawProtein !== undefined && rawProtein !== null && rawProtein !== "") {
    const p = Number(rawProtein);
    if (!Number.isFinite(p) || p < 10 || p > 500) {
      return NextResponse.json({ error: "Invalid protein goal" }, { status: 400 });
    }
    protein_goal_g = Math.round(p);
  }

  if (weight_kg && (weight_kg < 20 || weight_kg > 300)) {
    return NextResponse.json({ error: "Invalid weight" }, { status: 400 });
  }
  if (age && (age < 10 || age > 120)) {
    return NextResponse.json({ error: "Invalid age" }, { status: 400 });
  }

  // Try upsert with the new column first; fall back if it doesn't exist yet
  const tryFull = await supabase
    .from("user_profile")
    .upsert(
      { user_id: user.id, height_cm, weight_kg, age, protein_goal_g },
      { onConflict: "user_id" }
    )
    .select(FULL_COLS)
    .single();

  if (!tryFull.error) return NextResponse.json(tryFull.data);

  const msg = (tryFull.error.message || "").toLowerCase();
  if (msg.includes("protein_goal_g") || msg.includes("does not exist") || msg.includes("column")) {
    const legacy = await supabase
      .from("user_profile")
      .upsert(
        { user_id: user.id, height_cm, weight_kg, age },
        { onConflict: "user_id" }
      )
      .select(BASE_COLS)
      .single();
    if (legacy.error) {
      return NextResponse.json({ error: legacy.error.message }, { status: 500 });
    }
    return NextResponse.json({ ...legacy.data, protein_goal_g: null });
  }

  return NextResponse.json({ error: tryFull.error.message }, { status: 500 });
}
