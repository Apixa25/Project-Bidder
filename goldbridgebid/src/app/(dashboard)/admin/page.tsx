import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  FolderOpen,
  ClipboardList,
  Users,
  Flag,
  BarChart3,
  TrendingUp,
} from "lucide-react";

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

  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true });

  const { count: bidCount } = await supabase
    .from("bids")
    .select("*", { count: "exact", head: true });

  const { count: customerCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "customer");

  const { count: bidderCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "bidder");

  const { count: openProjects } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");

  const { count: flaggedCount } = await supabase
    .from("flagged_content")
    .select("*", { count: "exact", head: true })
    .eq("resolved", false);

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

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {projectCount || 0}
              </p>
              <p className="text-sm text-text-muted">Total Projects</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
              <TrendingUp className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {openProjects || 0}
              </p>
              <p className="text-sm text-text-muted">Open Projects</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <ClipboardList className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {bidCount || 0}
              </p>
              <p className="text-sm text-text-muted">Total Bids</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {customerCount || 0}
              </p>
              <p className="text-sm text-text-muted">Customers</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {bidderCount || 0}
              </p>
              <p className="text-sm text-text-muted">Bidders</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <Flag className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {flaggedCount || 0}
              </p>
              <p className="text-sm text-text-muted">Flagged Items</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/admin/projects", label: "View All Projects", icon: FolderOpen },
            { href: "/admin/bids", label: "View All Bids", icon: ClipboardList },
            { href: "/admin/users", label: "Manage Users", icon: Users },
            { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors"
            >
              <action.icon className="h-5 w-5 text-text-muted" />
              {action.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
