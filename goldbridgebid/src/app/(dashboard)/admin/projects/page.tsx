import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MapPin, Calendar, DollarSign } from "lucide-react";
import { TRADE_LABELS } from "@/types/database";
import type { TradeCategory } from "@/types/database";

export default async function AdminProjectsPage() {
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

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const customerIds = [...new Set((projects || []).map((p) => p.customer_id))];
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          All Projects 🏗️
        </h1>
        <p className="mt-1 text-text-secondary">
          Platform-wide project overview. {projects?.length || 0} total projects.
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
              {(projects || []).map((project) => {
                const customer = customerMap.get(project.customer_id);
                return (
                  <tr
                    key={project.id}
                    className="hover:bg-surface-hover transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-text-primary">
                        {project.title}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(project.trades as TradeCategory[]).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          >
                            {TRADE_LABELS[t]}
                          </span>
                        ))}
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

        {(!projects || projects.length === 0) && (
          <p className="px-6 py-12 text-center text-sm text-text-muted">
            No projects on the platform yet.
          </p>
        )}
      </div>
    </div>
  );
}
