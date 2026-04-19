import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if (body.name != null) patch.name = String(body.name).trim();
  if (body.quantity !== undefined) patch.quantity = body.quantity === null ? null : String(body.quantity);
  if (body.calories != null) {
    const c = Number(body.calories);
    if (!Number.isFinite(c) || c < 0 || c > 20000) {
      return NextResponse.json({ error: "Invalid calories" }, { status: 400 });
    }
    patch.calories = c;
  }
  if (body.protein != null) patch.protein = Number(body.protein) || 0;
  if (body.carbs != null) patch.carbs = Number(body.carbs) || 0;
  if (body.fat != null) patch.fat = Number(body.fat) || 0;
  if (body.sort_order != null) patch.sort_order = Number(body.sort_order) || 0;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("meal_presets")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("meal_presets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
