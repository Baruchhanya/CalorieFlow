import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mifitLogin } from "@/lib/mifit";

/** GET — returns whether the user has a connected Mi Fitness account. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_settings")
    .select("mifit_user_id, mifit_last_sync")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    connected:    !!data?.mifit_user_id,
    lastSync:     data?.mifit_last_sync ?? null,
  });
}

/**
 * POST — connect a Mi Fitness account.
 * Body: { email, password }
 * Authenticates against the Huami API, stores the resulting appToken + userId.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const email    = typeof body.email    === "string" ? body.email.trim()    : "";
  const password = typeof body.password === "string" ? body.password         : "";

  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  let credentials;
  try {
    credentials = await mifitLogin(email, password);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id:         user.id,
        mifit_app_token: credentials.appToken,
        mifit_user_id:   credentials.userId,
      },
      { onConflict: "user_id" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ connected: true, userId: credentials.userId });
}

/** DELETE — disconnect the Mi Fitness account. */
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase
    .from("user_settings")
    .update({ mifit_app_token: null, mifit_user_id: null, mifit_last_sync: null })
    .eq("user_id", user.id);

  return NextResponse.json({ connected: false });
}
