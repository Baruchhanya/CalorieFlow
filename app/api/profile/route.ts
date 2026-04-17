import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_profile")
    .select("height_cm, weight_kg, age")
    .eq("user_id", user.id)
    .single();

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

  if (weight_kg && (weight_kg < 20 || weight_kg > 300)) {
    return NextResponse.json({ error: "Invalid weight" }, { status: 400 });
  }
  if (age && (age < 10 || age > 120)) {
    return NextResponse.json({ error: "Invalid age" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_profile")
    .upsert(
      { user_id: user.id, height_cm, weight_kg, age },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
