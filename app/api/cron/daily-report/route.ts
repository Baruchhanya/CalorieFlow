import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getResend, buildDailyReportEmail } from "@/lib/resend";
import { getAllAllowedEmails } from "@/lib/auth";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  // Union of env-var emails and DB-managed allowed_users
  const allowedEmails = await getAllAllowedEmails();
  if (allowedEmails.length === 0) {
    return NextResponse.json({ error: "No allowed emails configured" }, { status: 500 });
  }

  const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const today = new Date().toISOString().split("T")[0];

  // Fetch all Supabase auth users via REST API
  const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=100`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  const { users = [] } = await adminRes.json();

  const results = [];

  for (const email of allowedEmails) {
    const user = (users as { id: string; email: string }[])
      .find((u) => u.email?.toLowerCase() === email);

    if (!user) {
      results.push({ email, status: "user not found in Supabase yet" });
      continue;
    }

    // Fetch this user's data
    const [mealsRes, settingsRes, activityRes] = await Promise.all([
      supabaseAdmin.from("meals").select("name, calories").eq("user_id", user.id).eq("date", today),
      supabaseAdmin.from("user_settings").select("daily_goal_calories").eq("user_id", user.id).single(),
      supabaseAdmin.from("daily_activity").select("calories_burned").eq("user_id", user.id).eq("date", today).single(),
    ]);

    const consumed = (mealsRes.data ?? []).reduce((s, m) => s + (m.calories ?? 0), 0);
    const burned = activityRes.data?.calories_burned ?? 0;
    const goalCalories = settingsRes.data?.daily_goal_calories ?? 1820;

    const emailPayload = buildDailyReportEmail({
      toEmail: email,
      date: today,
      consumed,
      burned,
      goalCalories,
      meals: (mealsRes.data ?? []).map((m) => ({ name: m.name, calories: m.calories })),
    });

    const { error } = await getResend().emails.send({
      from: "CalorieFlow <onboarding@resend.dev>",
      to: emailPayload.to,
      subject: emailPayload.subject,
      html: emailPayload.html,
    });

    results.push({ email, status: error ? `error: ${error}` : "sent", consumed, burned, goalCalories });
  }

  return NextResponse.json({ ok: true, date: today, results });
}
