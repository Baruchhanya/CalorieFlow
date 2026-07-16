import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { buildGoalResolver, DEFAULT_DAILY_GOAL } from "@/lib/goal";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [activityRes, settingsRes] = await Promise.all([
    supabase
      .from("daily_activity")
      .select("calories_burned, updated_at")
      .eq("user_id", user.id)
      .eq("date", date)
      .single(),
    supabase
      .from("user_settings")
      .select("daily_goal_calories")
      .eq("user_id", user.id)
      .single(),
  ]);

  const currentGoal = settingsRes.data?.daily_goal_calories ?? DEFAULT_DAILY_GOAL;
  const goalForDate = await buildGoalResolver(supabase, user.id, currentGoal);

  return NextResponse.json({
    calories_burned: activityRes.data?.calories_burned ?? 0,
    updated_at: activityRes.data?.updated_at ?? null,
    daily_goal_calories: goalForDate(date),
  });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
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
      { user_id: user.id, date, calories_burned: burned, source: "manual" },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
