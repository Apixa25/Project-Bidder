import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";
import { getStripeServerClient } from "@/lib/stripe/server";
import { reconcileEstimatePackagePurchaseFromCheckoutSession } from "@/lib/estimate-packages/purchases";
import {
  TRADE_LABELS,
  type EstimatePackage,
  type EstimatePackageFile,
  type EstimatePackageVersion,
  type TradeCategory,
} from "@/types/database";
import UnlockFreePackageButton from "./UnlockFreePackageButton";
import BuyPackageButton from "./BuyPackageButton";

function formatPrice(packageRow: Pick<EstimatePackage, "price_cents" | "currency">) {
  if (packageRow.price_cents === 0) return "Free";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: packageRow.currency.toUpperCase(),
  }).format(packageRow.price_cents / 100);
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatPackageType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function EstimatePackageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    packageCheckout?: string;
    session_id?: string;
  }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isAdmin = await userHasRole(user.id, "admin");
  const { data: packageRow } = await admin
    .from("estimate_packages")
    .select("*")
    .eq("id", id)
    .single();

  if (!packageRow) notFound();

  const currentPackage = packageRow as EstimatePackage;
  const isOwner = currentPackage.estimator_id === user.id;
  const nowIso = new Date().toISOString();

  if (
    resolvedSearchParams.packageCheckout === "success" &&
    resolvedSearchParams.session_id
  ) {
    try {
      await reconcileEstimatePackagePurchaseFromCheckoutSession({
        admin,
        stripe: getStripeServerClient(),
        sessionId: resolvedSearchParams.session_id,
        packageId: currentPackage.id,
        buyerId: user.id,
      });
    } catch (error) {
      console.error("Estimate package checkout reconciliation error:", error);
    }
  }

  const [
    { data: purchase },
    { data: grant },
  ] = await Promise.all([
    currentPackage.current_version_id
      ? admin
          .from("estimate_package_purchases")
          .select("id")
          .eq("package_version_id", currentPackage.current_version_id)
          .eq("buyer_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("estimate_package_access_grants")
      .select("id")
      .eq("package_id", currentPackage.id)
      .eq("grantee_user_id", user.id)
      .or(
        currentPackage.current_version_id
          ? `package_version_id.is.null,package_version_id.eq.${currentPackage.current_version_id}`
          : "package_version_id.is.null"
      )
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .maybeSingle(),
  ]);

  if (
    currentPackage.status !== "published" &&
    !isOwner &&
    !isAdmin &&
    !purchase &&
    !grant
  ) {
    notFound();
  }

  const [{ data: estimatorProfile }, { data: versionRow }, { data: reviews }] =
    await Promise.all([
      admin
        .from("estimator_profiles")
        .select("display_name, headline, bio, service_area, website_url, verification_status")
        .eq("user_id", currentPackage.estimator_id)
        .maybeSingle(),
      currentPackage.current_version_id
        ? admin
            .from("estimate_package_versions")
            .select("*")
            .eq("id", currentPackage.current_version_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    admin
      .from("estimate_package_reviews")
      .select("rating_overall")
      .eq("package_id", currentPackage.id)
      .eq("status", "published"),
    ]);

  const version = (versionRow || null) as EstimatePackageVersion | null;
  const hasAccess = isOwner || isAdmin || Boolean(purchase) || Boolean(grant);
  const canUnlockFree =
    currentPackage.status === "published" &&
    currentPackage.price_cents === 0 &&
    !hasAccess;
  const canBuyPackage =
    currentPackage.status === "published" &&
    currentPackage.price_cents > 0 &&
    !hasAccess &&
    !isOwner;

  const { data: packageFiles } =
    hasAccess && currentPackage.current_version_id
      ? await admin
          .from("estimate_package_files")
          .select("*")
          .eq("package_version_id", currentPackage.current_version_id)
          .order("display_order", { ascending: true })
          .order("uploaded_at", { ascending: true })
      : { data: [] };

  const files = (packageFiles || []) as EstimatePackageFile[];
  const reviewRows = reviews || [];
  const averageRating =
    reviewRows.length > 0
      ? reviewRows.reduce((sum, review) => sum + Number(review.rating_overall), 0) /
        reviewRows.length
      : null;

  return (
    <div>
      <Link
        href="/estimate-packages"
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Estimate Library
      </Link>

      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {formatPrice(currentPackage)}
              </span>
              <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                {formatPackageType(currentPackage.package_type)}
              </span>
              {version && (
                <span className="rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold text-text-secondary">
                  Version {version.version_number}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-text-primary">
              {currentPackage.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
              {currentPackage.summary}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(currentPackage.trades as TradeCategory[]).map((trade) => (
                <span
                  key={trade}
                  className="rounded-full bg-bg-warm px-2.5 py-1 text-xs font-medium text-text-secondary"
                >
                  {TRADE_LABELS[trade]}
                </span>
              ))}
            </div>
          </div>

          <aside className="w-full rounded-xl border border-border bg-bg-warm p-5 lg:w-80">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Estimator
            </p>
            <h2 className="mt-2 font-semibold text-text-primary">
              {estimatorProfile?.display_name || "Marketplace estimator"}
            </h2>
            {estimatorProfile?.headline && (
              <p className="mt-1 text-sm text-text-secondary">
                {estimatorProfile.headline}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {estimatorProfile?.verification_status === "verified" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
                <Star className="h-3.5 w-3.5" />
                {averageRating ? averageRating.toFixed(1) : "No reviews yet"}
              </span>
            </div>
            {estimatorProfile?.service_area && (
              <p className="mt-4 text-sm text-text-secondary">
                Service area: {estimatorProfile.service_area}
              </p>
            )}
          </aside>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="space-y-8">
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-text-primary">
              Scope Overview
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
              {version?.scope_overview || "No scope overview was provided."}
            </p>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-text-primary">
                Assumptions
              </h2>
              {version?.assumptions_json?.length ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
                  {version.assumptions_json.map((assumption, index) => (
                    <li key={`${assumption}-${index}`}>{assumption}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-text-muted">
                  No assumptions listed.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-text-primary">
                Exclusions
              </h2>
              {version?.exclusions_json?.length ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
                  {version.exclusions_json.map((exclusion, index) => (
                    <li key={`${exclusion}-${index}`}>{exclusion}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-text-muted">
                  No exclusions listed.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-text-primary">
              Package Files
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Unlock this package to download the version files.
            </p>

            {hasAccess ? (
              files.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {files.map((file) => (
                    <Link
                      key={file.id}
                      href={`/api/estimate-package-files/${file.id}/download`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-warm px-4 py-3 transition-colors hover:bg-surface-hover"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-text-primary">
                          {file.file_name}
                        </span>
                        <span className="text-xs text-text-muted">
                          {formatFileSize(file.file_size_bytes)}
                        </span>
                      </span>
                      <Download className="h-4 w-4 shrink-0 text-primary" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-dashed border-border bg-bg-warm p-4 text-center">
                  <FileText className="mx-auto mb-2 h-8 w-8 text-text-muted" />
                  <p className="text-sm text-text-secondary">
                    No files are attached to this package yet.
                  </p>
                </div>
              )
            ) : canUnlockFree ? (
              <div className="mt-5">
                <UnlockFreePackageButton packageId={currentPackage.id} />
              </div>
            ) : canBuyPackage ? (
              <div className="mt-5">
                {resolvedSearchParams.packageCheckout === "cancelled" && (
                  <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Checkout was cancelled. You can restart whenever you are
                    ready.
                  </p>
                )}
                <BuyPackageButton
                  packageId={currentPackage.id}
                  priceLabel={formatPrice(currentPackage)}
                />
                <p className="mt-3 text-xs leading-relaxed text-text-muted">
                  Files unlock after Stripe confirms payment. No dispute flow is
                  attached to package purchases; quality is handled through
                  reputation and reviews.
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <LockKeyhole className="mt-0.5 h-5 w-5 text-amber-700" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      Access required
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-amber-800">
                      This package requires a purchase or direct access grant
                      before files unlock.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

