import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_settings")
    .select("daily_goal_calories")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ daily_goal_calories: data?.daily_goal_calories ?? 1820 });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const goal = Number(body.daily_goal_calories);
  if (!goal || goal < 500 || goal > 10000) {
    return NextResponse.json({ error: "Invalid goal" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, daily_goal_calories: goal }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
