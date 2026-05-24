import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = new URL(request.url).searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const { data } = await supabase
    .from("day_acknowledgments")
    .select("estimated_balance")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();

  return NextResponse.json(data ?? null);
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, estimated_balance } = await request.json();
  if (!date || typeof estimated_balance !== "number") {
    return NextResponse.json({ error: "date and estimated_balance required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("day_acknowledgments")
    .upsert(
      { user_id: user.id, date, estimated_balance },
      { onConflict: "user_id,date" }
    )
    .select("estimated_balance")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = new URL(request.url).searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const { error } = await supabase
    .from("day_acknowledgments")
    .delete()
    .eq("user_id", user.id)
    .eq("date", date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
