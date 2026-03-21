import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BADGE_CONFIG } from "@/lib/badges";
import type { BadgeLevel } from "@/types/database";
import { User, Shield } from "lucide-react";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (currentProfile?.role !== "admin") redirect("/login");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const bidderUserIds = (profiles || [])
    .filter((p) => p.role === "bidder")
    .map((p) => p.user_id);

  const { data: credentials } =
    bidderUserIds.length > 0
      ? await supabase
          .from("bidder_credentials")
          .select("user_id, badge_level")
          .in("user_id", bidderUserIds)
      : { data: [] };

  const credMap = new Map(
    (credentials || []).map((c) => [c.user_id, c])
  );

  const customers = (profiles || []).filter((p) => p.role === "customer");
  const bidders = (profiles || []).filter((p) => p.role === "bidder");
  const admins = (profiles || []).filter((p) => p.role === "admin");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          User Management 👥
        </h1>
        <p className="mt-1 text-text-secondary">
          {profiles?.length || 0} total users — {customers.length} customers,{" "}
          {bidders.length} bidders, {admins.length} admins.
        </p>
      </div>

      <div className="space-y-8">
        {/* Customers */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            Customers ({customers.length})
          </h2>
          <div className="rounded-xl border border-border bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-warm text-left">
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Name
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Email
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Phone
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Location
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-surface-hover transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-text-primary">
                        {p.full_name}
                      </td>
                      <td className="px-6 py-4 text-text-secondary">
                        {p.email}
                      </td>
                      <td className="px-6 py-4 text-text-secondary">
                        {p.phone}
                      </td>
                      <td className="px-6 py-4 text-text-muted">
                        {p.city && p.state ? `${p.city}, ${p.state}` : p.address}
                      </td>
                      <td className="px-6 py-4 text-text-muted">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {customers.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-text-muted">
                No customers yet.
              </p>
            )}
          </div>
        </section>

        {/* Bidders */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            Bidders ({bidders.length})
          </h2>
          <div className="rounded-xl border border-border bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-warm text-left">
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Name
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Business
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Badge
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Email
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Phone
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bidders.map((p) => {
                    const creds = credMap.get(p.user_id);
                    const badge = creds?.badge_level as BadgeLevel;
                    const badgeInfo = badge ? BADGE_CONFIG[badge] : null;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-surface-hover transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-text-primary">
                          {p.full_name}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {p.business_name || "—"}
                        </td>
                        <td className="px-6 py-4">
                          {badgeInfo ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full ${badgeInfo.bgColor} px-2 py-0.5 text-xs font-medium ${badgeInfo.color}`}
                            >
                              {badgeInfo.icon} {badgeInfo.label}
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">
                              None
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {p.email}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {p.phone}
                        </td>
                        <td className="px-6 py-4 text-text-muted">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {bidders.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-text-muted">
                No bidders yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
