import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// When CF_DB_TIMING=1, log every Supabase HTTP call's duration + path so
// per-route round-trip counts and latency are visible in server logs.
const timedFetch: typeof fetch | undefined =
  process.env.CF_DB_TIMING === "1"
    ? async (input, init) => {
        const t0 = performance.now();
        const res = await fetch(input, init);
        const url = new URL(typeof input === "string" ? input : input instanceof Request ? input.url : input.href);
        console.log(`[db] ${Math.round(performance.now() - t0)}ms ${url.pathname}${url.search.slice(0, 80)}`);
        return res;
      }
    : undefined;

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(timedFetch ? { global: { fetch: timedFetch } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll throws in Server Components (read-only context) – safe to ignore
          }
        },
      },
    }
  );
}
