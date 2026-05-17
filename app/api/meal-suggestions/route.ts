import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Recent distinct meals from the diary (by name), for one-tap re-add. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("meals")
    .select("name, calories, protein, carbs, fat, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = { name: string; calories: number; protein: number; carbs: number; fat: number; count: number };
  const map = new Map<string, Row>();

  for (const row of data ?? []) {
    const raw = row.name?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      // First occurrence is the most recent (query is ORDER BY created_at DESC)
      map.set(key, {
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

  // Preserve insertion order = most-recently-eaten first
  const items = Array.from(map.values()).slice(0, 18);

  return NextResponse.json({ items });
}
