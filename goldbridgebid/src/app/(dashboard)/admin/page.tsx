import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  FolderOpen,
  ClipboardList,
  Users,
  Flag,
  BarChart3,
  TrendingUp,
  MessageSquare,
  ScrollText,
  AlertTriangle,
  Star,
  BadgeDollarSign,
  Scale,
} from "lucide-react";
import AdminStatCard from "@/components/admin/AdminStatCard";
import ActivityFeed, {
  type ActivityItem,
} from "@/components/admin/ActivityFeed";

const SEVEN_DAYS_AGO_ISO = new Date(
  Date.now() - 7 * 24 * 60 * 60 * 1000
).toISOString();

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/login");

  const [
    { data: customerRoles },
    { data: bidderRoles },
    { data: recentRoleMemberships },
    { count: totalReviews },
  ] = await Promise.all([
    supabase.from("user_roles").select("user_id").eq("role", "customer"),
    supabase.from("user_roles").select("user_id").eq("role", "bidder"),
    supabase
      .from("user_roles")
      .select("user_id, role, created_at")
      .gte("created_at", SEVEN_DAYS_AGO_ISO)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("user_reviews").select("*", { count: "exact", head: true }),
  ]);

  const customerCount = new Set((customerRoles || []).map((row) => row.user_id)).size;
  const bidderCount = new Set((bidderRoles || []).map((row) => row.user_id)).size;
  const customerRolesThisWeek = (recentRoleMemberships || []).filter(
    (row) => row.role === "customer"
  ).length;
  const bidderRolesThisWeek = (recentRoleMemberships || []).filter(
    (row) => row.role === "bidder"
  ).length;

  const [
    { count: projectCount },
    { count: bidCount },
    { count: openProjects },
    { count: flaggedCount },
    { count: bannedCount },
    { count: projectsThisWeek },
    { count: bidsThisWeek },
  ] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("bids").select("*", { count: "exact", head: true }),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("flagged_content")
      .select("*", { count: "exact", head: true })
      .eq("resolved", false),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_banned", true),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("bids")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
  ]);

  // Build activity feed from recent items
  const [
    { data: recentProjects },
    { data: recentBids },
    { data: recentProfiles },
    { data: recentFlags },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("bids")
      .select("id, project_id, price, trade, created_at, projects!inner(title)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("profiles")
      .select("user_id, full_name")
      .in(
        "user_id",
        Array.from(
          new Set((recentRoleMemberships || []).map((entry) => entry.user_id))
        )
      ),
    supabase
      .from("flagged_content")
      .select("id, content_type, reason, created_at")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const recentProfileMap = new Map(
    (recentProfiles || []).map((entry) => [entry.user_id, entry.full_name])
  );

  const activityItems: ActivityItem[] = [
    ...(recentProjects || []).map((p) => ({
      id: `proj-${p.id}`,
      type: "project" as const,
      title: `New project posted`,
      detail: p.title,
      time: timeAgo(p.created_at),
    })),
    ...(recentBids || []).map((b) => ({
      id: `bid-${b.id}`,
      type: "bid" as const,
      title: `New bid: $${Number(b.price).toLocaleString()}`,
      detail: (b.projects as unknown as { title: string }).title,
      time: timeAgo(b.created_at),
    })),
    ...(recentRoleMemberships || []).map((membership) => ({
      id: `role-${membership.user_id}-${membership.role}-${membership.created_at}`,
      type: "signup" as const,
      title: `${membership.role === "bidder" ? "Contractor" : "Customer"} mode enabled`,
      detail: recentProfileMap.get(membership.user_id) || "Unknown user",
      time: timeAgo(membership.created_at),
    })),
    ...(recentFlags || []).map((f) => ({
      id: `flag-${f.id}`,
      type: "flag" as const,
      title: `Content flagged (${f.content_type})`,
      detail: f.reason.length > 60 ? f.reason.slice(0, 60) + "..." : f.reason,
      time: timeAgo(f.created_at),
    })),
  ]
    .sort((a, b) => {
      const timeToMs = (t: string) => {
        if (t === "just now") return 0;
        const num = parseInt(t);
        if (t.includes("m")) return num * 60000;
        if (t.includes("h")) return num * 3600000;
        return num * 86400000;
      };
      return timeToMs(a.time) - timeToMs(b.time);
    })
    .slice(0, 15);

  const stats = [
    {
      label: "Total Projects",
      value: projectCount || 0,
      icon: FolderOpen,
      color: "bg-primary/10 text-primary",
      trend: { value: projectsThisWeek || 0, label: "this week" },
    },
    {
      label: "Open Projects",
      value: openProjects || 0,
      icon: TrendingUp,
      color: "bg-green-100 text-green-700",
    },
    {
      label: "Total Bids",
      value: bidCount || 0,
      icon: ClipboardList,
      color: "bg-amber-100 text-amber-700",
      trend: { value: bidsThisWeek || 0, label: "this week" },
    },
    {
      label: "Customers",
      value: customerCount || 0,
      icon: Users,
      color: "bg-blue-100 text-blue-600",
      trend: { value: customerRolesThisWeek || 0, label: "enabled this week" },
    },
    {
      label: "Bidders",
      value: bidderCount || 0,
      icon: Users,
      color: "bg-secondary/10 text-secondary",
      trend: { value: bidderRolesThisWeek || 0, label: "enabled this week" },
    },
    {
      label: "Reviews",
      value: totalReviews || 0,
      icon: Star,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Flagged Items",
      value: flaggedCount || 0,
      icon: Flag,
      color:
        (flaggedCount || 0) > 0
          ? "bg-red-100 text-red-600"
          : "bg-green-100 text-green-600",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Admin Dashboard 🛡️
        </h1>
        <p className="mt-1 text-text-secondary">
          Platform overview and management.
        </p>
      </div>

      {/* Alert Banners */}
      {((flaggedCount || 0) > 0 || (bannedCount || 0) > 0) && (
        <div className="mb-6 space-y-2">
          {(flaggedCount || 0) > 0 && (
            <Link
              href="/admin/flags"
              className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm hover:bg-red-100 transition-colors"
            >
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <span className="font-medium text-red-800">
                {flaggedCount} unresolved flag
                {flaggedCount !== 1 ? "s" : ""} need attention
              </span>
            </Link>
          )}
          {(bannedCount || 0) > 0 && (
            <Link
              href="/admin/users?banned=true"
              className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <span className="font-medium text-amber-800">
                {bannedCount} user{bannedCount !== 1 ? "s" : ""} currently
                banned
              </span>
            </Link>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <AdminStatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Two Column: Activity + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Activity Feed */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            Recent Activity
          </h2>
          <ActivityFeed items={activityItems} />
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            Quick Actions
          </h2>
          <div className="space-y-2">
            {[
              {
                href: "/admin/projects",
                label: "All Projects",
                icon: FolderOpen,
              },
              {
                href: "/admin/bids",
                label: "All Bids",
                icon: ClipboardList,
              },
              { href: "/admin/users", label: "Manage Users", icon: Users },
              {
                href: "/admin/messages",
                label: "Messages",
                icon: MessageSquare,
              },
              { href: "/admin/flags", label: "Flagged Content", icon: Flag },
              { href: "/admin/reviews", label: "Reviews", icon: Star },
              {
                href: "/admin/paid-estimates",
                label: "Paid Estimates",
                icon: BadgeDollarSign,
              },
              {
                href: "/admin/disputes",
                label: "Disputes",
                icon: Scale,
              },
              {
                href: "/admin/analytics",
                label: "Analytics",
                icon: BarChart3,
              },
              {
                href: "/admin/audit",
                label: "Audit Log",
                icon: ScrollText,
              },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors"
              >
                <action.icon className="h-5 w-5 text-text-muted" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
