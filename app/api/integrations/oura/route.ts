import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

/** GET — returns whether the user has a connected Oura account. */
export async function GET() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_settings")
    .select("oura_access_token, oura_last_sync")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    connected: !!data?.oura_access_token,
    lastSync:  data?.oura_last_sync ?? null,
  });
}

/** DELETE — disconnect the Oura account. */
export async function DELETE() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase
    .from("user_settings")
    .update({
      oura_access_token: null,
      oura_refresh_token: null,
      oura_token_expires_at: null,
      oura_last_sync: null,
    })
    .eq("user_id", user.id);

  return NextResponse.json({ connected: false });
}
