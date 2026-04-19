import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("meal_presets")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const calories = Number(body.calories);
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!Number.isFinite(calories) || calories < 0 || calories > 20000) {
    return NextResponse.json({ error: "Invalid calories" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("meal_presets")
    .insert({
      user_id: user.id,
      name,
      quantity: body.quantity != null ? String(body.quantity) : null,
      calories,
      protein: Number(body.protein) || 0,
      carbs: Number(body.carbs) || 0,
      fat: Number(body.fat) || 0,
      sort_order: Number(body.sort_order) || 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
