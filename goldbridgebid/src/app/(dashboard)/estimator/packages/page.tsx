import { redirect } from "next/navigation";
import Link from "next/link";
import { LibraryBig, PackagePlus, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import type { EstimatePackage } from "@/types/database";
import PublishPackageButton from "./PublishPackageButton";

function formatPrice(packageRow: Pick<EstimatePackage, "price_cents" | "currency">) {
  if (packageRow.price_cents === 0) return "Free";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: packageRow.currency.toUpperCase(),
  }).format(packageRow.price_cents / 100);
}

export default async function EstimatorPackagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "estimator"))) redirect("/login");

  const { data: packages } = await supabase
    .from("estimate_packages")
    .select("*")
    .eq("estimator_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">My Estimate Packages</h1>
          <p className="mt-1 text-text-secondary">
            Draft, publish, and maintain marketplace estimate packages.
          </p>
        </div>
        <Link
          href="/estimator/packages/new"
          className="inline-flex items-center gap-2 rounded-lg bg-accent-light px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110"
        >
          <PackagePlus className="h-4 w-4" />
          New Package
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Package Library</h2>
        </div>
        {(packages || []).length === 0 ? (
          <div className="px-6 py-12 text-center">
            <LibraryBig className="mx-auto mb-4 h-10 w-10 text-text-muted" />
            <h3 className="text-base font-semibold text-text-primary">
              No packages yet
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
              Create your first draft package. A version 1 snapshot will be
              saved immediately so buyers can later access a stable package
              version.
            </p>
            <Link
              href="/estimator/packages/new"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent-light px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110"
            >
              <PackagePlus className="h-4 w-4" />
              Create Package
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(packages || []).map((packageRow) => (
              <div
                key={packageRow.id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    href={`/estimator/packages/${packageRow.id}`}
                    className="font-semibold text-text-primary transition-colors hover:text-primary"
                  >
                    {packageRow.title}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                    {packageRow.summary}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold capitalize text-text-secondary">
                    {packageRow.status}
                  </span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {formatPrice(packageRow)}
                  </span>
                  <Link
                    href={`/estimator/packages/${packageRow.id}/edit`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-warm px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                  {packageRow.status === "draft" && (
                    <PublishPackageButton packageId={packageRow.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

