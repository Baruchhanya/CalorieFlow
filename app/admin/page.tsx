import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkEmailAccess } from "@/lib/auth";
import AdminClient from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await checkEmailAccess(user.email, supabase);
  if (!access.isAdmin) redirect("/");

  return <AdminClient meEmail={user.email ?? ""} />;
}
