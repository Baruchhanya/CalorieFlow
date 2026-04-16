import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getResend, buildDailyReportEmail } from "@/lib/resend";

// Vercel Cron calls this endpoint with Authorization: Bearer CRON_SECRET
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const allowedEmail = process.env.NEXT_PUBLIC_ALLOWED_EMAIL;

  if (!serviceKey || !supabaseUrl || !allowedEmail) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find user by email
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
  const user = users.find((u) => u.email?.toLowerCase() === allowedEmail.toLowerCase());
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Fetch today's meals
  const { data: meals } = await supabaseAdmin
    .from("meals")
    .select("name, calories")
    .eq("user_id", user.id)
    .eq("date", today);

  // Fetch settings
  const { data: settings } = await supabaseAdmin
    .from("user_settings")
    .select("daily_goal_calories")
    .eq("user_id", user.id)
    .single();

  // Fetch burned calories
  const { data: activity } = await supabaseAdmin
    .from("daily_activity")
    .select("calories_burned")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  const consumed = (meals ?? []).reduce((s, m) => s + (m.calories ?? 0), 0);
  const burned = activity?.calories_burned ?? 0;
  const goalCalories = settings?.daily_goal_calories ?? 2000;

  const emailPayload = buildDailyReportEmail({
    toEmail: allowedEmail,
    date: today,
    consumed,
    burned,
    goalCalories,
    meals: (meals ?? []).map((m) => ({ name: m.name, calories: m.calories })),
  });

  const { error } = await getResend().emails.send({
    from: "CalorieFlow <onboarding@resend.dev>",
    to: emailPayload.to,
    subject: emailPayload.subject,
    html: emailPayload.html,
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, date: today, consumed, burned, goalCalories });
}
