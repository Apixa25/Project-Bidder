import { redirect } from "next/navigation";
import { LibraryBig } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { EstimatePackage } from "@/types/database";

function formatPrice(packageRow: Pick<EstimatePackage, "price_cents" | "currency">) {
  if (packageRow.price_cents === 0) return "Free";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: packageRow.currency.toUpperCase(),
  }).format(packageRow.price_cents / 100);
}

export default async function AdminEstimatePackagesPage() {
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

  if (!profile || profile.role !== "admin") redirect("/login");

  const { data: packages } = await supabase
    .from("estimate_packages")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);

  const estimatorIds = Array.from(
    new Set((packages || []).map((packageRow) => packageRow.estimator_id))
  );
  const { data: estimatorProfiles } = estimatorIds.length
    ? await supabase
        .from("estimator_profiles")
        .select("user_id, display_name, verification_status")
        .in("user_id", estimatorIds)
    : { data: [] };
  const estimatorMap = new Map(
    (estimatorProfiles || []).map((entry) => [entry.user_id, entry])
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Estimate Packages</h1>
        <p className="mt-1 text-text-secondary">
          Admin visibility into the general estimator marketplace library.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        {(packages || []).length === 0 ? (
          <div className="px-6 py-12 text-center">
            <LibraryBig className="mx-auto mb-4 h-10 w-10 text-text-muted" />
            <h2 className="text-base font-semibold text-text-primary">
              No estimate packages yet
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
              Packages will appear here as estimator accounts begin publishing
              marketplace listings.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(packages || []).map((packageRow) => {
              const estimator = estimatorMap.get(packageRow.estimator_id);

              return (
                <div key={packageRow.id} className="px-6 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="font-semibold text-text-primary">
                        {packageRow.title}
                      </h2>
                      <p className="mt-1 text-sm text-text-secondary">
                        {estimator?.display_name || "Estimator profile pending"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold capitalize text-text-secondary">
                        {packageRow.status}
                      </span>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {formatPrice(packageRow)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

