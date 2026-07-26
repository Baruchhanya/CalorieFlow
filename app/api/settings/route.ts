import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { DEFAULT_DAILY_GOAL } from "@/lib/goal";

const SEED_PAST_DATE = "1970-01-01";

function serverTodayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

export async function GET() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_settings")
    .select("daily_goal_calories")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ daily_goal_calories: data?.daily_goal_calories ?? DEFAULT_DAILY_GOAL });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const goal = Number(body.daily_goal_calories);
  if (!goal || goal < 500 || goal > 10000) {
    return NextResponse.json({ error: "Invalid goal" }, { status: 400 });
  }

  // Client may send its local "today" to pin the change date to user's local calendar.
  const todayRaw = typeof body.today_date === "string" ? body.today_date : "";
  const today = /^\d{4}-\d{2}-\d{2}$/.test(todayRaw) ? todayRaw : serverTodayUTC();

  // Read current goal + history existence in one parallel batch.
  const [settingsRead, historyRead] = await Promise.all([
    supabase
      .from("user_settings")
      .select("daily_goal_calories")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("goal_history")
      .select("id")
      .eq("user_id", user.id)
      .limit(1),
  ]);
  const previousGoal = settingsRead.data?.daily_goal_calories ?? DEFAULT_DAILY_GOAL;

  // Maintain goal_history so past days keep their previous goal. The three
  // writes touch independent rows/tables, so they can run in parallel.
  const writes: PromiseLike<unknown>[] = [];
  if (previousGoal !== goal) {
    if (!historyRead.data || historyRead.data.length === 0) {
      // First-ever change — seed history with the prior value for all past dates.
      writes.push(
        supabase
          .from("goal_history")
          .insert({ user_id: user.id, effective_date: SEED_PAST_DATE, daily_goal_calories: previousGoal })
      );
    }
    writes.push(
      supabase
        .from("goal_history")
        .upsert(
          { user_id: user.id, effective_date: today, daily_goal_calories: goal },
          { onConflict: "user_id,effective_date" },
        )
    );
  }

  const settingsWrite = supabase
    .from("user_settings")
    .upsert({ user_id: user.id, daily_goal_calories: goal }, { onConflict: "user_id" })
    .select()
    .single();

  const [{ data, error }] = await Promise.all([settingsWrite, ...writes]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
