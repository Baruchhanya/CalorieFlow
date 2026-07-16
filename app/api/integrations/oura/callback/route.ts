import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { exchangeOuraCode } from "@/lib/oura";

const STATE_COOKIE = "oura_oauth_state";

/** GET /api/integrations/oura/callback — Oura redirects here after user consent. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (error || !code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/?oura_error=1`);
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/?oura_error=1`);
  }

  try {
    const redirectUri = `${origin}/api/integrations/oura/callback`;
    const tokens = await exchangeOuraCode(clientId, clientSecret, code, redirectUri);

    await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: user.id,
          oura_access_token: tokens.accessToken,
          oura_refresh_token: tokens.refreshToken,
          oura_token_expires_at: tokens.expiresAt,
        },
        { onConflict: "user_id" },
      );
  } catch {
    return NextResponse.redirect(`${origin}/?oura_error=1`);
  }

  return NextResponse.redirect(`${origin}/?oura_connected=1`);
}
