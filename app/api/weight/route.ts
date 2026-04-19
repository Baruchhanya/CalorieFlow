import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("weight_log")
    .select("id, date, weight_kg")
    .eq("user_id", user.id)
    .order("date", { ascending: true });

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const weight_kg = Number(body.weight_kg);
  const date = body.date as string;

  if (!date || isNaN(weight_kg) || weight_kg < 20 || weight_kg > 300) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];
  if (date > today) {
    return NextResponse.json({ error: "Future date not allowed" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("weight_log")
    .upsert(
      { user_id: user.id, date, weight_kg },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("weight_log").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
