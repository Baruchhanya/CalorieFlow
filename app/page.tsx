import HomeClient from "@/components/HomeClient";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { fetchCriticalInitData, type CriticalInitData } from "@/lib/initData";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
    ? params.date
    : today;

  // Fetch the critical payload during SSR so first paint carries real data
  // instead of a skeleton waiting on a client-side /api/init round trip.
  // The proxy redirects unauthenticated page requests, so user is normally set;
  // if not, HomeClient falls back to its client-side fetch.
  let initialData: CriticalInitData | null = null;
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (user) {
    initialData = await fetchCriticalInitData(supabase, user, date);
  }

  return <HomeClient initialDate={date} initialData={initialData} />;
}
