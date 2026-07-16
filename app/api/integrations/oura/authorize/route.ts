import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { buildOuraAuthorizeUrl } from "@/lib/oura";

const STATE_COOKIE = "oura_oauth_state";

/** GET /api/integrations/oura/authorize — redirects to Oura's OAuth consent screen. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.OURA_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "OURA_CLIENT_ID not configured" }, { status: 500 });

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/integrations/oura/callback`;
  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildOuraAuthorizeUrl(clientId, redirectUri, state));
}
