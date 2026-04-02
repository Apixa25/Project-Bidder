import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export default async function AdminPaidEstimatesPage() {
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

  const { data: pools } = await admin
    .from("project_paid_estimate_pools")
    .select("*")
    .order("created_at", { ascending: false });

  const projectIds = [...new Set((pools || []).map((pool) => pool.project_id))];
  const { data: projects } = projectIds.length
    ? await supabase.from("projects").select("id, title").in("id", projectIds)
    : { data: [] };

  const projectMap = new Map((projects || []).map((item) => [item.id, item.title]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          Paid Estimate Pools 💸
        </h1>
        <p className="mt-1 text-text-secondary">
          Review funded offers, slot usage, and reserve/refund totals across the
          marketplace.
        </p>
      </div>

      <div className="space-y-4">
        {(pools || []).length === 0 ? (
          <div className="rounded-xl border border-border bg-surface py-12 text-center shadow-sm">
            <p className="text-sm text-text-muted">No paid estimate pools exist yet.</p>
          </div>
        ) : (
          (pools || []).map((pool) => (
            <article
              key={pool.id}
              className="rounded-xl border border-border bg-surface p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {pool.status.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-semibold text-secondary">
                      {pool.filter.replace(/_/g, " ")}
                    </span>
                  </div>

                  <h2 className="mt-3 text-base font-semibold text-text-primary">
                    <Link
                      href={`/admin/projects/${pool.project_id}`}
                      className="hover:text-primary"
                    >
                      {projectMap.get(pool.project_id) || "Deleted project"}
                    </Link>
                  </h2>

                  <div className="mt-3 grid gap-3 text-sm text-text-secondary sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg bg-bg-warm px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-text-muted">
                        Reward
                      </p>
                      <p className="mt-1 font-semibold text-text-primary">
                        ${Number(pool.reward_amount).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-bg-warm px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-text-muted">
                        Claimed Slots
                      </p>
                      <p className="mt-1 font-semibold text-text-primary">
                        {pool.claimed_paid_slots} / {pool.max_paid_slots}
                      </p>
                    </div>
                    <div className="rounded-lg bg-bg-warm px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-text-muted">
                        Reserved
                      </p>
                      <p className="mt-1 font-semibold text-text-primary">
                        ${Number(pool.reserved_total_amount).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-bg-warm px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-text-muted">
                        Refunded
                      </p>
                      <p className="mt-1 font-semibold text-text-primary">
                        ${Number(pool.refunded_total_amount).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-bg-warm px-4 py-3 text-sm text-text-secondary">
                  <p>
                    Funded total:{" "}
                    <span className="font-semibold text-text-primary">
                      ${Number(pool.funded_total_amount).toLocaleString()}
                    </span>
                  </p>
                  <p className="mt-1">
                    Contractor payout:{" "}
                    <span className="font-semibold text-text-primary">
                      ${Number(pool.contractor_payout_amount).toLocaleString()}
                    </span>
                  </p>
                  <p className="mt-1">
                    Platform fee:{" "}
                    <span className="font-semibold text-text-primary">
                      ${Number(pool.platform_fee_amount).toLocaleString()}
                    </span>
                  </p>
                  {pool.funded_at && (
                    <p className="mt-1 text-xs text-text-muted">
                      Funded {new Date(pool.funded_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
