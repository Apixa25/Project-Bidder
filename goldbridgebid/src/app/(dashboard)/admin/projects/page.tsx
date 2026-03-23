import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TRADE_LABELS } from "@/types/database";
import type { TradeCategory } from "@/types/database";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import AdminFilterBar, { FilterDropdown } from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import ExportButton from "@/components/admin/ExportButton";

const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function AdminProjectsPage({ searchParams }: Props) {
  const params = await searchParams;
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

  // Fetch all projects (filter on server side)
  let query = supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.status) {
    query = query.eq("status", params.status);
  }

  const { data: allProjects } = await query;

  // Client-side search filtering (for title, customer name, location)
  const searchTerm = (params.q || "").toLowerCase();
  const customerIds = [
    ...new Set((allProjects || []).map((p) => p.customer_id)),
  ];
  const { data: customerProfiles } =
    customerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", customerIds)
      : { data: [] };

  const customerMap = new Map(
    (customerProfiles || []).map((p) => [p.user_id, p])
  );

  let filtered = (allProjects || []).filter((p) => {
    if (searchTerm) {
      const customer = customerMap.get(p.customer_id);
      const searchable = [
        p.title,
        customer?.full_name,
        customer?.email,
        p.location_city,
        p.location_state,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(searchTerm)) return false;
    }
    if (params.trade) {
      if (!(p.trades as TradeCategory[]).includes(params.trade as TradeCategory))
        return false;
    }
    return true;
  });

  const totalItems = filtered.length;
  const page = Math.max(1, Number(params.page || "1"));
  const paginated = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const exportData = filtered.map((p) => {
    const customer = customerMap.get(p.customer_id);
    return {
      title: p.title,
      customer: customer?.full_name || "",
      status: p.status,
      bids: p.bid_count,
      location: `${p.location_city}, ${p.location_state}`,
      posted: new Date(p.created_at).toLocaleDateString(),
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
            All Projects 🏗️
          </h1>
          <p className="mt-1 text-text-secondary">
            {totalItems} project{totalItems !== 1 ? "s" : ""} found.
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename="goldbridgebid-projects"
          columns={[
            { key: "title", label: "Title" },
            { key: "customer", label: "Customer" },
            { key: "status", label: "Status" },
            { key: "bids", label: "Bids" },
            { key: "location", label: "Location" },
            { key: "posted", label: "Posted" },
          ]}
        />
      </div>

      {/* Search & Filters */}
      <div className="mb-6 space-y-4">
        <div className="max-w-md">
          <AdminSearchBar placeholder="Search projects, customers, locations..." />
        </div>
        <AdminFilterBar>
          <FilterDropdown
            paramName="status"
            label="Status"
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

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-warm text-left">
                <th className="px-6 py-3 font-semibold text-text-primary">
                  Project
                </th>
                <th className="px-6 py-3 font-semibold text-text-primary">
                  Customer
                </th>
                <th className="px-6 py-3 font-semibold text-text-primary">
                  Status
                </th>
                <th className="px-6 py-3 font-semibold text-text-primary">
                  Bids
                </th>
                <th className="px-6 py-3 font-semibold text-text-primary">
                  Location
                </th>
                <th className="px-6 py-3 font-semibold text-text-primary">
                  Posted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((project) => {
                const customer = customerMap.get(project.customer_id);
                return (
                  <tr
                    key={project.id}
                    className="hover:bg-surface-hover transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/projects/${project.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {project.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(project.trades as TradeCategory[])
                          .slice(0, 3)
                          .map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                            >
                              {TRADE_LABELS[t]}
                            </span>
                          ))}
                        {(project.trades as TradeCategory[]).length > 3 && (
                          <span className="text-xs text-text-muted">
                            +{(project.trades as TradeCategory[]).length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-text-primary">
                        {customer?.full_name || "—"}
                      </p>
                      <p className="text-xs text-text-muted">
                        {customer?.email}
                      </p>
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
                    <td className="px-6 py-4 text-center font-medium text-text-primary">
                      {project.bid_count}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {project.location_city}, {project.location_state}
                    </td>
                    <td className="px-6 py-4 text-text-muted">
                      {new Date(project.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalItems === 0 && (
          <p className="px-6 py-12 text-center text-sm text-text-muted">
            No projects match your filters.
          </p>
        )}
      </div>

      <AdminPagination totalItems={totalItems} pageSize={PAGE_SIZE} />
    </div>
  );
}
