import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("meals")
    .select("date, calories, protein, carbs, fat")
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate by date in JS (avoids needing a custom RPC function)
  const map = new Map<
    string,
    { date: string; count: number; calories: number; protein: number; carbs: number; fat: number }
  >();

  for (const row of data ?? []) {
    const entry = map.get(row.date) ?? {
      date: row.date,
      count: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    entry.count += 1;
    entry.calories += row.calories;
    entry.protein += row.protein;
    entry.carbs += row.carbs;
    entry.fat += row.fat;
    map.set(row.date, entry);
  }

  const result = Array.from(map.values()).map((g) => ({
    ...g,
    calories: Math.round(g.calories),
    protein: Math.round(g.protein),
    carbs: Math.round(g.carbs),
    fat: Math.round(g.fat),
  }));

  return NextResponse.json(result);
}
