import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("meals")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const today = new Date().toISOString().split("T")[0];

  // Support both single item and batch insert
  const items = Array.isArray(body) ? body : [body];
  const rows = items.map((item) => ({
    user_id: user.id,
    date: item.date ?? today,
    name: item.name,
    quantity: item.quantity ?? null,
    calories: Number(item.calories),
    protein: Number(item.protein),
    carbs: Number(item.carbs),
    fat: Number(item.fat),
    note: item.note ?? null,
  }));

  const { data, error } = await supabase
    .from("meals")
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return single item for single input, array for batch
  if (!Array.isArray(body)) {
    return NextResponse.json(data?.[0] ?? null, { status: 201 });
  }
  return NextResponse.json(data ?? [], { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const ids: string[] = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }
  if (ids.length > 100) {
    return NextResponse.json({ error: "Maximum 100 ids per batch delete" }, { status: 400 });
  }

  const { error } = await supabase
    .from("meals")
    .delete()
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, deleted: ids.length });
}
