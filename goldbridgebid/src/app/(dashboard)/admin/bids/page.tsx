import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TRADE_LABELS } from "@/types/database";
import type { TradeCategory } from "@/types/database";
import { BADGE_CONFIG } from "@/lib/badges";
import type { BadgeLevel } from "@/types/database";

export default async function AdminBidsPage() {
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

  const { data: bids } = await supabase
    .from("bids")
    .select("*, projects!inner(title, status)")
    .order("created_at", { ascending: false });

  const bidderIds = [...new Set((bids || []).map((b) => b.bidder_id))];
  const { data: bidderProfiles } =
    bidderIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, full_name, email, business_name")
          .in("user_id", bidderIds)
      : { data: [] };

  const { data: bidderCreds } =
    bidderIds.length > 0
      ? await supabase
          .from("bidder_credentials")
          .select("user_id, badge_level")
          .in("user_id", bidderIds)
      : { data: [] };

  const profileMap = new Map(
    (bidderProfiles || []).map((p) => [p.user_id, p])
  );
  const credMap = new Map(
    (bidderCreds || []).map((c) => [c.user_id, c])
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">All Bids 📋</h1>
        <p className="mt-1 text-text-secondary">
          Every bid submitted across the platform. {bids?.length || 0} total
          bids.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-warm text-left">
                <th className="px-6 py-3 font-semibold text-text-primary">
                  Project
                </th>
                <th className="px-6 py-3 font-semibold text-text-primary">
                  Bidder
                </th>
                <th className="px-6 py-3 font-semibold text-text-primary">
                  Badge
                </th>
                <th className="px-6 py-3 font-semibold text-text-primary">
                  Trade
                </th>
                <th className="px-6 py-3 font-semibold text-text-primary">
                  Price
                </th>
                <th className="px-6 py-3 font-semibold text-text-primary">
                  Status
                </th>
                <th className="px-6 py-3 font-semibold text-text-primary">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(bids || []).map((bid) => {
                const project = bid.projects as unknown as {
                  title: string;
                  status: string;
                };
                const bidder = profileMap.get(bid.bidder_id);
                const creds = credMap.get(bid.bidder_id);
                const badge = creds?.badge_level as BadgeLevel;
                const badgeInfo = badge ? BADGE_CONFIG[badge] : null;

                return (
                  <tr
                    key={bid.id}
                    className="hover:bg-surface-hover transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-text-primary">
                        {project.title}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-text-primary">
                        {bidder?.full_name || "—"}
                      </p>
                      <p className="text-xs text-text-muted">
                        {bidder?.business_name || bidder?.email}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {badgeInfo ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full ${badgeInfo.bgColor} px-2 py-0.5 text-xs font-medium ${badgeInfo.color}`}
                        >
                          {badgeInfo.icon} {badgeInfo.label}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {TRADE_LABELS[bid.trade as TradeCategory]}
                    </td>
                    <td className="px-6 py-4 font-semibold text-text-primary">
                      ${Number(bid.price).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          project.status === "open"
                            ? "bg-green-100 text-green-700"
                            : project.status === "awarded"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {project.status.charAt(0).toUpperCase() +
                          project.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-muted">
                      {new Date(bid.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(!bids || bids.length === 0) && (
          <p className="px-6 py-12 text-center text-sm text-text-muted">
            No bids on the platform yet.
          </p>
        )}
      </div>
    </div>
  );
}
