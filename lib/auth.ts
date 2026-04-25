import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the lowercased "super admin" emails seeded via env var.
 * These are always allowed and always admins — they cannot be removed
 * via the UI, which guarantees the operator can never lock themselves out.
 */
export function getEnvAdminEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS ?? process.env.NEXT_PUBLIC_ALLOWED_EMAIL ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEnvAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getEnvAdminEmails().includes(email.toLowerCase());
}

/**
 * Server-side admin client (uses the service role key — bypasses RLS).
 * Only ever instantiate from server routes, never from client/browser.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createServiceClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface AccessStatus {
  allowed: boolean;
  isAdmin: boolean;
  source: "env" | "db" | "open" | "denied";
}

/**
 * Check whether a given email is allowed to access the app and whether
 * they are an admin.
 *
 * Order:
 *   1. env-var emails (ALLOWED_EMAILS) → always allowed + admin
 *   2. DB row in `allowed_users` → allowed; admin if `is_admin = true`
 *   3. If both env-var list AND DB are EMPTY → open (back-compat with old "no
 *      allowlist = open access" behaviour).
 *   4. Otherwise → denied.
 *
 * Pass an existing user-scoped supabase client to leverage the user's RLS
 * policy ("user can read their own row"). If unavailable, falls back to
 * a service-role lookup.
 */
export async function checkEmailAccess(
  email: string | null | undefined,
  client?: SupabaseClient
): Promise<AccessStatus> {
  if (!email) return { allowed: false, isAdmin: false, source: "denied" };
  const lower = email.toLowerCase();

  if (isEnvAdmin(lower)) {
    return { allowed: true, isAdmin: true, source: "env" };
  }

  // Try the lightweight user-scoped query first (uses the request's session)
  let dbHit:
    | { is_admin: boolean | null }
    | null
    | undefined;

  if (client) {
    try {
      const res = await client
        .from("allowed_users")
        .select("is_admin")
        .ilike("email", lower)
        .maybeSingle();
      if (!res.error) dbHit = res.data ?? null;
    } catch {
      // Table missing or RLS blocked – fall through to service-role lookup
    }
  }

  // Fallback to service role (used by middleware contexts where the user
  // session isn't guaranteed to satisfy RLS exactly)
  if (dbHit === undefined) {
    try {
      const admin = createServiceRoleClient();
      const res = await admin
        .from("allowed_users")
        .select("is_admin")
        .ilike("email", lower)
        .maybeSingle();
      if (!res.error) dbHit = res.data ?? null;
    } catch {
      dbHit = null;
    }
  }

  if (dbHit) {
    return { allowed: true, isAdmin: !!dbHit.is_admin, source: "db" };
  }

  // If absolutely no allowlist is configured anywhere, keep the historical
  // "open access" behaviour so a fresh install doesn't lock everyone out.
  if (getEnvAdminEmails().length === 0) {
    let dbHasAny = false;
    try {
      const admin = createServiceRoleClient();
      const res = await admin
        .from("allowed_users")
        .select("id", { count: "exact", head: true });
      if (!res.error) dbHasAny = (res.count ?? 0) > 0;
    } catch {
      dbHasAny = false;
    }
    if (!dbHasAny) {
      return { allowed: true, isAdmin: false, source: "open" };
    }
  }

  return { allowed: false, isAdmin: false, source: "denied" };
}

/**
 * Returns the union of env-var emails and DB allowed emails (lowercased,
 * de-duplicated). Used by the daily-report cron so newly-added users get
 * their nightly emails too.
 */
export async function getAllAllowedEmails(): Promise<string[]> {
  const set = new Set<string>(getEnvAdminEmails());

  try {
    const admin = createServiceRoleClient();
    const { data } = await admin.from("allowed_users").select("email");
    for (const row of data ?? []) {
      if (row?.email) set.add(String(row.email).toLowerCase());
    }
  } catch {
    // Table missing – just return env-var emails
  }

  return Array.from(set);
}
