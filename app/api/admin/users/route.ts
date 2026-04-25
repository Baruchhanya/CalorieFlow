import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkEmailAccess,
  createServiceRoleClient,
  getEnvAdminEmails,
  isEnvAdmin,
} from "@/lib/auth";

interface AllowedUserRow {
  id: string;
  email: string;
  is_admin: boolean;
  added_by: string | null;
  created_at: string;
}

export interface AdminUsersResponse {
  envAdmins: string[];
  users: (AllowedUserRow & { is_env_admin: boolean })[];
  me: { email: string; is_admin: true };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  return { user, supabase };
}

/** GET /api/admin/users — list every allowed user (env super-admins + DB rows) */
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const me = guard.user!;

  const envAdmins = getEnvAdminEmails();
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("allowed_users")
    .select("id, email, is_admin, added_by, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as AllowedUserRow[];
  const payload: AdminUsersResponse = {
    envAdmins,
    users: rows.map((r) => ({ ...r, is_env_admin: envAdmins.includes(r.email.toLowerCase()) })),
    me: { email: me.email!, is_admin: true },
  };
  return NextResponse.json(payload);
}

/** POST /api/admin/users  body: { email, is_admin? } */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const me = guard.user!;

  const body = await request.json().catch(() => ({}));
  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const wantAdmin = !!body.is_admin;

  if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (rawEmail.length > 254) {
    return NextResponse.json({ error: "Email too long" }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  // Check existing row (case-insensitive) to give a friendly error
  const existing = await admin
    .from("allowed_users")
    .select("id")
    .ilike("email", rawEmail)
    .maybeSingle();
  if (existing.data) {
    return NextResponse.json(
      { error: "Email already in the allowlist" },
      { status: 409 }
    );
  }

  const insert = await admin
    .from("allowed_users")
    .insert({
      email: rawEmail,
      is_admin: wantAdmin,
      added_by: me.email ?? null,
    })
    .select("id, email, is_admin, added_by, created_at")
    .single();

  if (insert.error) {
    return NextResponse.json({ error: insert.error.message }, { status: 500 });
  }

  return NextResponse.json(
    { ...insert.data, is_env_admin: isEnvAdmin(insert.data.email) },
    { status: 201 }
  );
}
