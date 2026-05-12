import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/layout/DashboardShell";
import { getUserRoles } from "@/lib/auth/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const _layoutStart = Date.now();
  const supabase = await createClient();

  const _authStart = Date.now();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log(`[PERF dashboard-layout] auth.getUser: ${Date.now() - _authStart}ms`);

  if (!user) {
    redirect("/login");
  }

  const _parallelStart = Date.now();
  const [{ data: profile }, availableRoles, { count: unreadCount }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single(),
      getUserRoles(user.id),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false),
    ]);
  console.log(`[PERF dashboard-layout] parallel queries (profile+roles+notifications): ${Date.now() - _parallelStart}ms`);
  console.log(`[PERF dashboard-layout] TOTAL: ${Date.now() - _layoutStart}ms`);

  if (!profile) {
    redirect("/login");
  }

  return (
    <DashboardShell
      defaultRole={profile.role}
      availableRoles={availableRoles}
      userName={profile.full_name || profile.email}
      avatarUrl={profile.avatar_url}
      unreadNotifications={unreadCount || 0}
    >
      {children}
    </DashboardShell>
  );
}
