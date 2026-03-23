import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TRADE_LABELS } from "@/types/database";
import type { TradeCategory } from "@/types/database";
import AnalyticsDashboard from "./AnalyticsDashboard";

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

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Aggregate counts
  const [
    { count: totalProjects },
    { count: openProjects },
    { count: awardedProjects },
    { count: closedProjects },
    { count: totalBids },
    { count: totalCustomers },
    { count: totalBidders },
    { count: totalMessages },
    { count: unresolvedFlags },
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
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer"),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "bidder"),
    supabase.from("messages").select("*", { count: "exact", head: true }),
    supabase
      .from("flagged_content")
      .select("*", { count: "exact", head: true })
      .eq("resolved", false),
  ]);

  // Projects over time (last 30 days)
  const { data: recentProjects } = await supabase
    .from("projects")
    .select("created_at")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: true });

  // Bids over time (last 30 days)
  const { data: recentBids } = await supabase
    .from("bids")
    .select("created_at, price, trade")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: true });

  // User signups over time (last 30 days)
  const { data: recentSignups } = await supabase
    .from("profiles")
    .select("created_at, role")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: true });

  // Projects by trade (need all projects for trade breakdown)
  const { data: allProjects } = await supabase
    .from("projects")
    .select("trades");

  // Geographic distribution
  const { data: geoProjects } = await supabase
    .from("projects")
    .select("location_state");

  const { data: geoUsers } = await supabase
    .from("profiles")
    .select("state");

  // All bids for avg by trade
  const { data: allBids } = await supabase
    .from("bids")
    .select("price, trade");

  // Top projects by bid count
  const { data: topProjects } = await supabase
    .from("projects")
    .select("id, title, bid_count, location_city, location_state")
    .order("bid_count", { ascending: false })
    .limit(10);

  // --- Process data for charts ---

  // Daily counts helper
  function dailyCounts(items: { created_at: string }[] | null) {
    const counts: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
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

  // User growth (cumulative)
  const userGrowth: { date: string; customers: number; bidders: number }[] = [];
  let custCum = (totalCustomers || 0) - (recentSignups || []).filter((s) => s.role === "customer").length;
  let bidCum = (totalBidders || 0) - (recentSignups || []).filter((s) => s.role === "bidder").length;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const daySignups = (recentSignups || []).filter(
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

  // Trade breakdown
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

  // Status donut
  const statusBreakdown = [
    { name: "Open", value: openProjects || 0 },
    { name: "Awarded", value: awardedProjects || 0 },
    { name: "Closed", value: closedProjects || 0 },
  ];

  // Avg bid by trade
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

  // Geographic distribution
  const geoCounts: Record<
    string,
    { projects: number; users: number }
  > = {};
  for (const p of geoProjects || []) {
    const st = p.location_state || "Unknown";
    if (!geoCounts[st]) geoCounts[st] = { projects: 0, users: 0 };
    geoCounts[st].projects++;
  }
  for (const u of geoUsers || []) {
    const st = u.state || "Unknown";
    if (!geoCounts[st]) geoCounts[st] = { projects: 0, users: 0 };
    geoCounts[st].users++;
  }
  const geoData = Object.entries(geoCounts)
    .map(([state, counts]) => ({ state, ...counts }))
    .sort((a, b) => b.projects + b.users - (a.projects + a.users));

  return (
    <AnalyticsDashboard
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
      topProjects={
        (topProjects || []).map((p) => ({
          title: p.title,
          bids: p.bid_count,
          location: `${p.location_city}, ${p.location_state}`,
        }))
      }
    />
  );
}
