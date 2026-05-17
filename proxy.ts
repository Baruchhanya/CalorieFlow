import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkEmailAccess } from "@/lib/auth";

// HttpOnly cookie that caches a successful allowlist check for 5 minutes.
// Value is the user's ID so it's automatically invalidated on sign-in/out.
const ACCESS_COOKIE = "_cf_ok";
const ACCESS_COOKIE_TTL = 300; // seconds

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session – must be called before any auth checks
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/"); // API routes handle auth themselves (return 401)

  // Redirect unauthenticated users to login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Enforce allowlist (env-var super-admins ∪ DB-managed allowed_users).
  // Skip the DB query when the access cookie already confirms this user is allowed —
  // saves ~100-200ms on every navigation after the first request.
  if (user && !isPublicPath) {
    const cached = request.cookies.get(ACCESS_COOKIE)?.value;
    if (cached !== user.id) {
      const access = await checkEmailAccess(user.email, supabase);
      if (!access.allowed) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "unauthorized");
        url.searchParams.set("actual", user.email ?? "unknown");
        return NextResponse.redirect(url);
      }
      supabaseResponse.cookies.set(ACCESS_COOKIE, user.id, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: ACCESS_COOKIE_TTL,
        path: "/",
      });
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
