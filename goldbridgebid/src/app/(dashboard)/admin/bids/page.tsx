import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { TRADE_LABELS } from "@/types/database";
import type { TradeCategory, BadgeLevel } from "@/types/database";
import { BADGE_CONFIG } from "@/lib/badges";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import AdminFilterBar, { FilterDropdown } from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import ExportButton from "@/components/admin/ExportButton";
import ProjectStatusPill from "@/components/project/ProjectStatusPill";

const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function AdminBidsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

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

  let query = admin
    .from("bids")
    .select("*, projects!bids_project_id_fkey(title, status)")
    .order("created_at", { ascending: false });

  if (params.trade) {
    query = query.eq("trade", params.trade);
  }

  const { data: allBids, error: allBidsError } = await query;
  if (allBidsError) {
    console.error("Admin bids query failed:", allBidsError);
  }

  const bidderIds = [...new Set((allBids || []).map((b) => b.bidder_id))];
  const { data: bidderProfiles } =
    bidderIds.length > 0
      ? await admin
          .from("profiles")
          .select("user_id, full_name, email, business_name")
          .in("user_id", bidderIds)
      : { data: [] };

  const { data: bidderCreds } =
    bidderIds.length > 0
      ? await admin
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

  const searchTerm = (params.q || "").toLowerCase();

  const filtered = (allBids || []).filter((bid) => {
    const project = bid.projects as unknown as {
      title: string;
      status: string;
    };
    const bidder = profileMap.get(bid.bidder_id);

    if (searchTerm) {
      const searchable = [
        project.title,
        bidder?.full_name,
        bidder?.business_name,
        bidder?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(searchTerm)) return false;
    }

    if (params.status && project.status !== params.status) return false;

    return true;
  });

  const totalItems = filtered.length;
  const page = Math.max(1, Number(params.page || "1"));
  const paginated = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const exportData = filtered.map((bid) => {
    const project = bid.projects as unknown as {
      title: string;
      status: string;
    };
    const bidder = profileMap.get(bid.bidder_id);
    return {
      project: project.title,
      bidder: bidder?.full_name || "",
      business: bidder?.business_name || "",
      trade: TRADE_LABELS[bid.trade as TradeCategory] || bid.trade,
      price: Number(bid.price),
      status: project.status,
      submitted: new Date(bid.created_at).toLocaleDateString(),
    };
  });

  const tradeOptions = Object.entries(TRADE_LABELS)
    .slice(0, 20)
    .map(([value, label]) => ({ value, label }));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            All Bids 📋
          </h1>
          <p className="mt-1 text-text-secondary">
            {totalItems} bid{totalItems !== 1 ? "s" : ""} found.
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename="projectxbidx-bids"
          columns={[
            { key: "project", label: "Project" },
            { key: "bidder", label: "Bidder" },
            { key: "business", label: "Business" },
            { key: "trade", label: "Trade" },
            { key: "price", label: "Price" },
            { key: "status", label: "Project Status" },
            { key: "submitted", label: "Submitted" },
          ]}
        />
      </div>

      <div className="mb-6 space-y-4">
        <div className="max-w-md">
          <AdminSearchBar placeholder="Search by project, bidder, business..." />
        </div>
        <AdminFilterBar>
          <FilterDropdown
            paramName="status"
            label="Project Status"
            options={[
              { value: "open", label: "Open" },
              { value: "awarded", label: "Awarded" },
              { value: "closed", label: "Closed" },
            ]}
          />
          <FilterDropdown
            paramName="trade"
            label="Trade"
            options={tradeOptions}
          />
        </AdminFilterBar>
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
              {paginated.map((bid) => {
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
                      <Link
                        href={`/admin/projects/${bid.project_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {project.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/users/${bid.bidder_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {bidder?.full_name || "—"}
                      </Link>
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
                    <td className="text-money px-6 py-4 font-semibold">
                      ${Number(bid.price).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <ProjectStatusPill status={project.status} />
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

        {totalItems === 0 && (
          <p className="px-6 py-12 text-center text-sm text-text-muted">
            No bids match your filters.
          </p>
        )}
      </div>

      <AdminPagination totalItems={totalItems} pageSize={PAGE_SIZE} />
    </div>
  );
}
