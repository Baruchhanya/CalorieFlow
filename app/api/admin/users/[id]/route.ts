import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkEmailAccess,
  createServiceRoleClient,
  isEnvAdmin,
} from "@/lib/auth";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const access = await checkEmailAccess(user.email, supabase);
  if (!access.isAdmin) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user };
}

/** DELETE /api/admin/users/[id] — remove an allowed user (cannot remove env super-admins or yourself) */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const me = guard.user!;

  const { id } = await context.params;
  const admin = createServiceRoleClient();

  const target = await admin
    .from("allowed_users")
    .select("id, email")
    .eq("id", id)
    .maybeSingle();
  if (target.error || !target.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const targetEmail = String(target.data.email).toLowerCase();
  if (isEnvAdmin(targetEmail)) {
    return NextResponse.json(
      { error: "Cannot remove an env-configured super-admin" },
      { status: 400 }
    );
  }
  if (me.email && targetEmail === me.email.toLowerCase()) {
    return NextResponse.json(
      { error: "You cannot remove yourself" },
      { status: 400 }
    );
  }

  const del = await admin.from("allowed_users").delete().eq("id", id);
  if (del.error) {
    return NextResponse.json({ error: del.error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

/** PATCH /api/admin/users/[id]  body: { is_admin: boolean } */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const me = guard.user!;

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.is_admin !== "boolean") {
    return NextResponse.json({ error: "is_admin (boolean) required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const target = await admin
    .from("allowed_users")
    .select("id, email")
    .eq("id", id)
    .maybeSingle();
  if (target.error || !target.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const targetEmail = String(target.data.email).toLowerCase();
  // Env super-admins CAN be demoted via PATCH — the env entry only guarantees
  // "allowed", not admin. The DB row is the source of truth for is_admin.
  if (me.email && targetEmail === me.email.toLowerCase() && body.is_admin === false) {
    return NextResponse.json(
      { error: "You cannot demote yourself" },
      { status: 400 }
    );
  }

  const upd = await admin
    .from("allowed_users")
    .update({ is_admin: body.is_admin })
    .eq("id", id)
    .select("id, email, is_admin, added_by, created_at")
    .single();

  if (upd.error) {
    return NextResponse.json({ error: upd.error.message }, { status: 500 });
  }
  return NextResponse.json({ ...upd.data, is_env_admin: isEnvAdmin(upd.data.email) });
}
