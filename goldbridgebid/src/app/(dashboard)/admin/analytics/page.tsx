import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  FolderOpen,
  ClipboardList,
  Users,
  TrendingUp,
  DollarSign,
  BarChart3,
} from "lucide-react";

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/login");

  const { count: totalProjects } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true });

  const { count: openProjects } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");

  const { count: awardedProjects } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("status", "awarded");

  const { count: closedProjects } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("status", "closed");

  const { count: totalBids } = await supabase
    .from("bids")
    .select("*", { count: "exact", head: true });

  const { count: totalCustomers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "customer");

  const { count: totalBidders } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "bidder");

  const { count: totalMessages } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true });

  const { count: unresolvedFlags } = await supabase
    .from("flagged_content")
    .select("*", { count: "exact", head: true })
    .eq("resolved", false);

  const { data: recentBids } = await supabase
    .from("bids")
    .select("price")
    .order("created_at", { ascending: false })
    .limit(100);

  const avgBidPrice =
    recentBids && recentBids.length > 0
      ? recentBids.reduce((sum, b) => sum + Number(b.price), 0) /
        recentBids.length
      : 0;

  const bidsPerProject =
    totalProjects && totalBids
      ? (totalBids / totalProjects).toFixed(1)
      : "0";

  const stats = [
    {
      label: "Total Projects",
      value: totalProjects || 0,
      icon: FolderOpen,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Open Projects",
      value: openProjects || 0,
      icon: FolderOpen,
      color: "bg-green-100 text-green-700",
    },
    {
      label: "Awarded Projects",
      value: awardedProjects || 0,
      icon: TrendingUp,
      color: "bg-amber-100 text-amber-700",
    },
    {
      label: "Closed Projects",
      value: closedProjects || 0,
      icon: FolderOpen,
      color: "bg-gray-100 text-gray-600",
    },
    {
      label: "Total Bids",
      value: totalBids || 0,
      icon: ClipboardList,
      color: "bg-secondary/10 text-secondary",
    },
    {
      label: "Avg. Bid Price",
      value: `$${Math.round(avgBidPrice).toLocaleString()}`,
      icon: DollarSign,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Bids per Project",
      value: bidsPerProject,
      icon: BarChart3,
      color: "bg-blue-100 text-blue-600",
    },
    {
      label: "Customers",
      value: totalCustomers || 0,
      icon: Users,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Bidders",
      value: totalBidders || 0,
      icon: Users,
      color: "bg-secondary/10 text-secondary",
    },
    {
      label: "Total Messages",
      value: totalMessages || 0,
      icon: BarChart3,
      color: "bg-blue-100 text-blue-600",
    },
    {
      label: "Unresolved Flags",
      value: unresolvedFlags || 0,
      icon: BarChart3,
      color:
        (unresolvedFlags || 0) > 0
          ? "bg-red-100 text-red-600"
          : "bg-green-100 text-green-600",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Platform Analytics 📊
        </h1>
        <p className="mt-1 text-text-secondary">
          Real-time metrics across GoldBridgeBid.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-surface p-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}
              >
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">
                  {stat.value}
                </p>
                <p className="text-sm text-text-muted">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Project Status Breakdown */}
      <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Project Status Breakdown
        </h2>
        <div className="space-y-3">
          {[
            {
              label: "Open",
              count: openProjects || 0,
              color: "bg-green-500",
            },
            {
              label: "Awarded",
              count: awardedProjects || 0,
              color: "bg-amber-500",
            },
            {
              label: "Closed",
              count: closedProjects || 0,
              color: "bg-gray-400",
            },
          ].map((item) => {
            const total = totalProjects || 1;
            const pct = Math.round((item.count / total) * 100);
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-text-primary">
                    {item.label}
                  </span>
                  <span className="text-sm text-text-muted">
                    {item.count} ({pct}%)
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-bg-warm overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.color} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
