import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getResend, buildMonthlyReportEmail, type PeriodReportDay } from "@/lib/resend";
import { getAllAllowedEmails } from "@/lib/auth";
import { buildGoalResolver, DEFAULT_DAILY_GOAL } from "@/lib/goal";

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

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

  const allowedEmails = await getAllAllowedEmails();
  if (allowedEmails.length === 0) {
    return NextResponse.json({ error: "No allowed emails configured" }, { status: 500 });
  }

  const filterEmail = new URL(req.url).searchParams.get("email")?.toLowerCase();
  const targetEmails = filterEmail
    ? allowedEmails.filter((e) => e === filterEmail)
    : allowedEmails;
  if (filterEmail && targetEmails.length === 0) {
    return NextResponse.json({ error: `email ${filterEmail} not in allowed list` }, { status: 400 });
  }

  const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Period: previous calendar month (assumes this cron runs on the 1st).
  const todayDate = new Date();
  const startDate = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
  const endDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0); // day 0 = last day of previous month
  const periodStart = fmtDate(startDate);
  const periodEnd = fmtDate(endDate);

  const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=100`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  const { users = [] } = await adminRes.json();

  const results = [];

  for (const email of targetEmails) {
    const user = (users as { id: string; email: string }[])
      .find((u) => u.email?.toLowerCase() === email);

    if (!user) {
      results.push({ email, status: "user not found in Supabase yet" });
      continue;
    }

    const [mealsRes, activityRes, settingsRes, acksRes] = await Promise.all([
      supabaseAdmin.from("meals").select("date, calories").eq("user_id", user.id)
        .gte("date", periodStart).lte("date", periodEnd),
      supabaseAdmin.from("daily_activity").select("date, calories_burned").eq("user_id", user.id)
        .gte("date", periodStart).lte("date", periodEnd),
      supabaseAdmin.from("user_settings").select("daily_goal_calories").eq("user_id", user.id).single(),
      supabaseAdmin.from("day_acknowledgments").select("date, estimated_balance").eq("user_id", user.id)
        .gte("date", periodStart).lte("date", periodEnd),
    ]);

    const currentGoal = settingsRes.data?.daily_goal_calories ?? DEFAULT_DAILY_GOAL;
    const goalForDate = await buildGoalResolver(supabaseAdmin, user.id, currentGoal);

    const calorieMap = new Map<string, number>();
    for (const m of mealsRes.data ?? []) {
      calorieMap.set(m.date, (calorieMap.get(m.date) ?? 0) + (m.calories ?? 0));
    }
    const activityMap = new Map<string, number>();
    for (const a of activityRes.data ?? []) {
      activityMap.set(a.date, a.calories_burned ?? 0);
    }
    const ackMap = new Map<string, number>();
    for (const a of acksRes.data ?? []) {
      ackMap.set(a.date, a.estimated_balance);
    }

    const days: PeriodReportDay[] = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const dateStr = fmtDate(cur);
      const consumed = calorieMap.get(dateStr);
      if (consumed !== undefined) {
        const burned = activityMap.get(dateStr) ?? 0;
        days.push({ date: dateStr, balance: Math.round((consumed - burned) - goalForDate(dateStr)) });
      } else if (ackMap.has(dateStr)) {
        days.push({ date: dateStr, balance: ackMap.get(dateStr)!, estimated: true });
      }
      cur.setDate(cur.getDate() + 1);
    }

    const emailPayload = buildMonthlyReportEmail({
      toEmail: email,
      periodLabel: "חודשי",
      periodStart,
      periodEnd,
      days,
    });

    const { error } = await getResend().emails.send({
      from: "CalorieFlow <onboarding@resend.dev>",
      to: emailPayload.to,
      subject: emailPayload.subject,
      html: emailPayload.html,
    });

    results.push({ email, status: error ? `error: ${error}` : "sent", days: days.length });
  }

  return NextResponse.json({ ok: true, periodStart, periodEnd, results });
}
