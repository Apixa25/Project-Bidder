import { redirect } from "next/navigation";
import Link from "next/link";
import { LibraryBig, LockKeyhole, ReceiptText, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  TRADE_LABELS,
  type EstimatePackage,
  type TradeCategory,
} from "@/types/database";

function formatPrice(packageRow: Pick<EstimatePackage, "price_cents" | "currency">) {
  if (packageRow.price_cents === 0) return "Free";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: packageRow.currency.toUpperCase(),
  }).format(packageRow.price_cents / 100);
}

export default async function EstimatePackageMarketplacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: packages } = await supabase
    .from("estimate_packages")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  const estimatorIds = Array.from(
    new Set((packages || []).map((packageRow) => packageRow.estimator_id))
  );
  const { data: estimatorProfiles } = estimatorIds.length
    ? await supabase
        .from("estimator_profiles")
        .select("user_id, display_name, headline, verification_status")
        .in("user_id", estimatorIds)
    : { data: [] };
  const estimatorMap = new Map(
    (estimatorProfiles || []).map((entry) => [entry.user_id, entry])
  );

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Estimate Package Library
          </h1>
          <p className="mt-1 max-w-3xl text-text-secondary">
            Browse professional takeoffs, bid-ready scopes, estimate worksheets,
            and plan reviews from marketplace estimators.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/estimate-packages/purchases"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-secondary shadow-sm transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <ReceiptText className="h-4 w-4" />
            My Estimate Packages
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
            <Sparkles className="h-4 w-4" />
            Reputation-led quality
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 text-primary" />
          <p className="text-sm leading-relaxed text-text-secondary">
            Package previews are browseable by authenticated users. Full files
            unlock only when a package is free, purchased, granted by the
            estimator, or viewed by an admin.
          </p>
        </div>
      </div>

      {(packages || []).length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center shadow-sm">
          <LibraryBig className="mx-auto mb-4 h-10 w-10 text-text-muted" />
          <h2 className="text-base font-semibold text-text-primary">
            No published estimate packages yet
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
            This marketplace is ready for estimator-published packages once the
            package creation workflow is added.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {(packages || []).map((packageRow) => {
            const estimator = estimatorMap.get(packageRow.estimator_id);

            return (
              <Link
                key={packageRow.id}
                href={`/estimate-packages/${packageRow.id}`}
                className="rounded-xl border border-border bg-surface p-6 shadow-sm"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">
                      {packageRow.title}
                    </h2>
                    <p className="mt-1 text-sm text-text-muted">
                      By {estimator?.display_name || "Marketplace estimator"}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {formatPrice(packageRow)}
                  </span>
                </div>
                <p className="line-clamp-3 text-sm leading-relaxed text-text-secondary">
                  {packageRow.summary}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(packageRow.trades as TradeCategory[]).slice(0, 4).map((trade) => (
                    <span
                      key={trade}
                      className="rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary"
                    >
                      {TRADE_LABELS[trade]}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

