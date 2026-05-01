import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Download, LibraryBig, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TRADE_LABELS,
  type EstimatePackage,
  type EstimatePackageFile,
  type EstimatePackagePurchase,
  type TradeCategory,
} from "@/types/database";

function formatPrice(cents: number, currency: string) {
  if (cents === 0) return "Free";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function EstimatePackagePurchasesPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: purchaseRows } = await admin
    .from("estimate_package_purchases")
    .select("*")
    .eq("buyer_id", user.id)
    .order("purchased_at", { ascending: false })
    .limit(100);

  const purchases = (purchaseRows || []) as EstimatePackagePurchase[];
  const packageIds = Array.from(
    new Set(purchases.map((purchase) => purchase.package_id))
  );
  const versionIds = Array.from(
    new Set(purchases.map((purchase) => purchase.package_version_id))
  );
  const sellerIds = Array.from(
    new Set(purchases.map((purchase) => purchase.seller_id))
  );

  const [
    { data: packageRows },
    { data: estimatorProfiles },
    { data: fileRows },
  ] = await Promise.all([
    packageIds.length
      ? admin.from("estimate_packages").select("*").in("id", packageIds)
      : Promise.resolve({ data: [] }),
    sellerIds.length
      ? admin
          .from("estimator_profiles")
          .select("user_id, display_name, headline, verification_status")
          .in("user_id", sellerIds)
      : Promise.resolve({ data: [] }),
    versionIds.length
      ? admin
          .from("estimate_package_files")
          .select("id, package_version_id")
          .in("package_version_id", versionIds)
      : Promise.resolve({ data: [] }),
  ]);

  const packageMap = new Map(
    ((packageRows || []) as EstimatePackage[]).map((packageRow) => [
      packageRow.id,
      packageRow,
    ])
  );
  const estimatorMap = new Map(
    (estimatorProfiles || []).map((profile) => [profile.user_id, profile])
  );
  const fileCountMap = new Map<string, number>();
  ((fileRows || []) as Pick<EstimatePackageFile, "package_version_id">[]).forEach(
    (file) => {
      fileCountMap.set(
        file.package_version_id,
        (fileCountMap.get(file.package_version_id) || 0) + 1
      );
    }
  );

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            My Estimate Packages
          </h1>
          <p className="mt-1 max-w-3xl text-text-secondary">
            Return to estimate packages you have unlocked or purchased, including
            free packages saved through the marketplace.
          </p>
        </div>
        <Link
          href="/estimate-packages"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-secondary shadow-sm transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <LibraryBig className="h-4 w-4" />
          Browse Library
        </Link>
      </div>

      {purchases.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center shadow-sm">
          <ReceiptText className="mx-auto mb-4 h-10 w-10 text-text-muted" />
          <h2 className="text-base font-semibold text-text-primary">
            No estimate packages yet
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
            Free unlocks and paid purchases will appear here so you can return to
            package files later.
          </p>
          <Link
            href="/estimate-packages"
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:bg-primary-dark"
          >
            Browse Estimate Library
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {purchases.map((purchase) => {
            const packageRow = packageMap.get(purchase.package_id);
            const estimator = estimatorMap.get(purchase.seller_id);
            const fileCount = fileCountMap.get(purchase.package_version_id) || 0;

            return (
              <article
                key={purchase.id}
                className="rounded-xl border border-border bg-surface p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {formatPrice(purchase.price_cents, purchase.currency)}
                      </span>
                      <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                        Purchased {formatDate(purchase.purchased_at)}
                      </span>
                      <span className="rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold text-text-secondary">
                        {fileCount} {fileCount === 1 ? "file" : "files"}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-text-primary">
                      {packageRow?.title || "Estimate package"}
                    </h2>
                    <p className="mt-1 text-sm text-text-muted">
                      By {estimator?.display_name || "Marketplace estimator"}
                    </p>
                    {packageRow?.summary && (
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-text-secondary">
                        {packageRow.summary}
                      </p>
                    )}
                    {packageRow?.trades?.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(packageRow.trades as TradeCategory[])
                          .slice(0, 4)
                          .map((trade) => (
                            <span
                              key={trade}
                              className="rounded-full bg-bg-warm px-2.5 py-1 text-xs font-medium text-text-secondary"
                            >
                              {TRADE_LABELS[trade]}
                            </span>
                          ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                    <Link
                      href={`/estimate-packages/${purchase.package_id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-secondary-dark"
                    >
                      <Download className="h-4 w-4" />
                      Open Files
                    </Link>
                    <Link
                      href={`/estimate-packages/${purchase.package_id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    >
                      View Package
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

