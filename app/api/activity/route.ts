import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("daily_activity")
    .select("calories_burned")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();

  return NextResponse.json({ calories_burned: data?.calories_burned ?? 0 });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const date = body.date as string;
  const burned = Number(body.calories_burned);

  if (!date || isNaN(burned) || burned < 0) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("daily_activity")
    .upsert(
      { user_id: user.id, date, calories_burned: burned },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
