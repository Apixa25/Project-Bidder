import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/layout/DashboardShell";
import { getUserRoles } from "@/lib/auth/roles";
import ImpersonationBanner from "@/components/admin/ImpersonationBanner";
import { IMPERSONATE_COOKIE } from "@/lib/admin-constants";

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

  // Impersonation: check if admin is viewing as another user
  const cookieStore = await cookies();
  const impersonateUserId = cookieStore.get(IMPERSONATE_COOKIE)?.value;
  let impersonatedProfile: { full_name: string; role: string } | null = null;

  if (impersonateUserId && profile.role === "admin") {
    const { data: impProfile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("user_id", impersonateUserId)
      .single();
    impersonatedProfile = impProfile || null;
  }

  return (
    <DashboardShell
      defaultRole={profile.role}
      availableRoles={availableRoles}
      userName={profile.full_name || profile.email}
      avatarUrl={profile.avatar_url}
      unreadNotifications={unreadCount || 0}
    >
      {impersonatedProfile && (
        <ImpersonationBanner
          userName={impersonatedProfile.full_name}
          userRole={impersonatedProfile.role}
        />
      )}
      {children}
    </DashboardShell>
  );
}
