import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TRADE_LABELS } from "@/types/database";
import type { TradeCategory } from "@/types/database";
import dynamic from "next/dynamic";
import TimeRangeSelector from "@/components/admin/TimeRangeSelector";
import {
  type TimeRange,
  getRangeCutoff,
  getRangeDays,
  isValidRange,
} from "@/lib/time-range";

const AnalyticsDashboard = dynamic(() => import("./AnalyticsDashboard"), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  ),
});

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const nowMs = new Date().getTime();

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

  const range: TimeRange = isValidRange(params.range) ? params.range : "30d";
  const rangeDays = getRangeDays(range);
  const rangeCutoff = getRangeCutoff(range);

  const [
    { data: customerRoles },
    { data: bidderRoles },
    { data: recentRoleMemberships },
  ] = await Promise.all([
    supabase.from("user_roles").select("user_id").eq("role", "customer"),
    supabase.from("user_roles").select("user_id").eq("role", "bidder"),
    supabase
      .from("user_roles")
      .select("created_at, role")
      .gte("created_at", rangeCutoff)
      .order("created_at", { ascending: true }),
  ]);

  const totalCustomers = new Set((customerRoles || []).map((row) => row.user_id)).size;
  const totalBidders = new Set((bidderRoles || []).map((row) => row.user_id)).size;

  const [
    { count: totalProjects },
    { count: openProjects },
    { count: awardedProjects },
    { count: closedProjects },
    { count: totalBids },
    { count: totalMessages },
    { count: unresolvedFlags },
    { count: totalReviews },
  ] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("status", "awarded"),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("status", "closed"),
    supabase.from("bids").select("*", { count: "exact", head: true }),
    supabase.from("messages").select("*", { count: "exact", head: true }),
    supabase
      .from("flagged_content")
      .select("*", { count: "exact", head: true })
      .eq("resolved", false),
    supabase.from("user_reviews").select("*", { count: "exact", head: true }),
  ]);

  const { data: recentProjects } = await supabase
    .from("projects")
    .select("created_at")
    .gte("created_at", rangeCutoff)
    .order("created_at", { ascending: true });

  const { data: recentBids } = await supabase
    .from("bids")
    .select("created_at, price, trade")
    .gte("created_at", rangeCutoff)
    .order("created_at", { ascending: true });

  const { data: allProjects } = await supabase
    .from("projects")
    .select("trades");

  const { data: geoProjects } = await supabase
    .from("projects")
    .select("location_state, location_city");

  const { data: geoUsers } = await supabase
    .from("profiles")
    .select("state, city");

  const { data: allBids } = await supabase
    .from("bids")
    .select("price, trade");

  const { data: topProjects } = await supabase
    .from("projects")
    .select("id, title, bid_count, location_city, location_state")
    .order("bid_count", { ascending: false })
    .limit(10);

  // Conversion funnel data
  const [
    { count: totalSignups },
    { data: customersWithProjects },
    { data: projectsWithBids },
    { count: awardedOrCompleted },
  ] = await Promise.all([
    supabase.from("user_roles").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("customer_id"),
    supabase.from("bids").select("project_id"),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .in("status", ["awarded", "completed"]),
  ]);

  const uniqueCustomersPosted = new Set(
    (customersWithProjects || []).map((p) => p.customer_id)
  ).size;
  const uniqueProjectsWithBids = new Set(
    (projectsWithBids || []).map((b) => b.project_id)
  ).size;

  const funnelData = {
    totalSignups: totalSignups || 0,
    customersPosted: uniqueCustomersPosted,
    projectsWithBids: uniqueProjectsWithBids,
    projectsAwarded: awardedOrCompleted || 0,
  };

  function dailyCounts(items: { created_at: string }[] | null) {
    const counts: Record<string, number> = {};
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(nowMs - i * 86400000);
      counts[d.toISOString().slice(0, 10)] = 0;
    }
    for (const item of items || []) {
      const day = item.created_at.slice(0, 10);
      if (counts[day] !== undefined) counts[day]++;
    }
    return Object.entries(counts).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      count,
    }));
  }

  const projectsOverTime = dailyCounts(recentProjects);
  const bidsOverTime = dailyCounts(recentBids);

  const userGrowth: { date: string; customers: number; bidders: number }[] = [];
  let custCum =
    (totalCustomers || 0) -
    (recentRoleMemberships || []).filter((s) => s.role === "customer").length;
  let bidCum =
    (totalBidders || 0) -
    (recentRoleMemberships || []).filter((s) => s.role === "bidder").length;
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(nowMs - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const daySignups = (recentRoleMemberships || []).filter(
      (s) => s.created_at.slice(0, 10) === dateStr
    );
    custCum += daySignups.filter((s) => s.role === "customer").length;
    bidCum += daySignups.filter((s) => s.role === "bidder").length;
    userGrowth.push({
      date: d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      customers: custCum,
      bidders: bidCum,
    });
  }

  const tradeCounts: Record<string, number> = {};
  for (const p of allProjects || []) {
    for (const t of (p.trades as TradeCategory[]) || []) {
      tradeCounts[t] = (tradeCounts[t] || 0) + 1;
    }
  }
  const tradeBreakdown = Object.entries(tradeCounts)
    .map(([trade, count]) => ({
      trade: TRADE_LABELS[trade as TradeCategory] || trade,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const statusBreakdown = [
    { name: "Open", value: openProjects || 0 },
    { name: "Awarded", value: awardedProjects || 0 },
    { name: "Closed", value: closedProjects || 0 },
  ];

  const tradeAcc: Record<string, { sum: number; count: number }> = {};
  for (const b of allBids || []) {
    const t = b.trade as TradeCategory;
    if (!tradeAcc[t]) tradeAcc[t] = { sum: 0, count: 0 };
    tradeAcc[t].sum += Number(b.price);
    tradeAcc[t].count++;
  }
  const avgBidByTrade = Object.entries(tradeAcc)
    .map(([trade, acc]) => ({
      trade: TRADE_LABELS[trade as TradeCategory] || trade,
      avg: Math.round(acc.sum / acc.count),
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  // Geographic distribution — state + city level
  const geoCounts: Record<string, { projects: number; users: number }> = {};
  const cityCounts: Record<string, { projects: number; users: number }> = {};
  for (const p of geoProjects || []) {
    const st = p.location_state || "Unknown";
    if (!geoCounts[st]) geoCounts[st] = { projects: 0, users: 0 };
    geoCounts[st].projects++;
    const city = p.location_city && p.location_state
      ? `${p.location_city}, ${p.location_state}`
      : null;
    if (city) {
      if (!cityCounts[city]) cityCounts[city] = { projects: 0, users: 0 };
      cityCounts[city].projects++;
    }
  }
  for (const u of geoUsers || []) {
    const st = u.state || "Unknown";
    if (!geoCounts[st]) geoCounts[st] = { projects: 0, users: 0 };
    geoCounts[st].users++;
    const city = u.city && u.state ? `${u.city}, ${u.state}` : null;
    if (city) {
      if (!cityCounts[city]) cityCounts[city] = { projects: 0, users: 0 };
      cityCounts[city].users++;
    }
  }
  const geoData = Object.entries(geoCounts)
    .map(([state, counts]) => ({ state, ...counts }))
    .sort((a, b) => b.projects + b.users - (a.projects + a.users));

  const cityData = Object.entries(cityCounts)
    .map(([city, counts]) => ({ city, total: counts.projects + counts.users, ...counts }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Platform Analytics 📊
          </h1>
          <p className="mt-1 text-text-secondary">
            Metrics across projectxbidx.
          </p>
        </div>
        <TimeRangeSelector />
      </div>
      <AnalyticsDashboard
        rangeDays={rangeDays}
        stats={{
          totalProjects: totalProjects || 0,
          openProjects: openProjects || 0,
          awardedProjects: awardedProjects || 0,
          closedProjects: closedProjects || 0,
          totalBids: totalBids || 0,
          totalCustomers: totalCustomers || 0,
          totalBidders: totalBidders || 0,
          totalMessages: totalMessages || 0,
          unresolvedFlags: unresolvedFlags || 0,
          totalReviews: totalReviews || 0,
          avgBidPrice:
            allBids && allBids.length > 0
              ? Math.round(
                  allBids.reduce((s, b) => s + Number(b.price), 0) /
                    allBids.length
                )
              : 0,
          bidsPerProject:
            totalProjects && totalBids
              ? Number((totalBids / totalProjects).toFixed(1))
              : 0,
        }}
        projectsOverTime={projectsOverTime}
        bidsOverTime={bidsOverTime}
        userGrowth={userGrowth}
        tradeBreakdown={tradeBreakdown}
        statusBreakdown={statusBreakdown}
        avgBidByTrade={avgBidByTrade}
        geoData={geoData}
        cityData={cityData}
        topProjects={
          (topProjects || []).map((p) => ({
            title: p.title,
            bids: p.bid_count,
            location: `${p.location_city}, ${p.location_state}`,
          }))
        }
        funnelData={funnelData}
      />
    </div>
  );
}
