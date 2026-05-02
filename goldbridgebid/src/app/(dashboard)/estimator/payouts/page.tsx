import Link from "next/link";
import { redirect } from "next/navigation";
import { LibraryBig, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";
import {
  ESTIMATOR_PAYOUT_READINESS_LABELS,
  getEstimatorPayoutReadiness,
  isEstimatorReadyForPayouts,
} from "@/lib/estimate-packages/payout-accounts";
import type {
  EstimatePackagePurchase,
  EstimatorPayoutAccount,
} from "@/types/database";
import PayoutOnboardingActions from "./PayoutOnboardingActions";

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export default async function EstimatorPayoutsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "estimator"))) redirect("/login");

  const [{ data: payoutAccountRow }, { data: purchasesRaw }] = await Promise.all([
    admin
      .from("estimator_payout_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("estimate_package_purchases")
      .select("*, estimate_packages!inner(title)")
      .eq("seller_id", user.id)
      .order("purchased_at", { ascending: false })
      .limit(100),
  ]);

  const payoutAccount =
    (payoutAccountRow as EstimatorPayoutAccount | null | undefined) || null;
  const readiness = getEstimatorPayoutReadiness(payoutAccount);
  const isReady = isEstimatorReadyForPayouts(payoutAccount);
  const purchases = (purchasesRaw || []) as (EstimatePackagePurchase & {
    estimate_packages: { title: string };
  })[];
  const paidPurchases = purchases.filter((purchase) => purchase.price_cents > 0);
  const pendingPayoutCount = paidPurchases.filter(
    (purchase) => purchase.payout_status === "payout_pending"
  ).length;
  const totalSalesCents = paidPurchases.reduce(
    (sum, purchase) => sum + purchase.price_cents,
    0
  );
  const totalPayoutCents = paidPurchases.reduce(
    (sum, purchase) => sum + purchase.estimator_payout_cents,
    0
  );
  const paidOutCents = paidPurchases
    .filter((purchase) => purchase.payout_status === "paid_out")
    .reduce((sum, purchase) => sum + purchase.estimator_payout_cents, 0);

  const stripeConnectMessage =
    params.stripeConnect === "return"
      ? "Stripe returned you here. Refresh your status to sync the latest payout readiness."
      : params.stripeConnect === "refresh"
        ? "Stripe asked for a refresh. Continue onboarding when you are ready."
        : null;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Estimator Payouts
          </h1>
          <p className="mt-1 text-text-secondary">
            Connect banking through Stripe and track package sale payouts.
          </p>
        </div>
        <Link
          href="/estimator/packages"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
        >
          Manage Packages
        </Link>
      </div>

      {stripeConnectMessage && (
        <div className="mb-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary shadow-sm ring-1 ring-amber-200">
          {stripeConnectMessage}
        </div>
      )}

      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  readiness === "ready"
                    ? "bg-green-100 text-green-700"
                    : readiness === "restricted"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-700"
                }`}
              >
                {ESTIMATOR_PAYOUT_READINESS_LABELS[readiness]}
              </span>
              {pendingPayoutCount > 0 && (
                <span className="rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-semibold text-secondary">
                  {pendingPayoutCount} payout
                  {pendingPayoutCount === 1 ? "" : "s"} queued
                </span>
              )}
            </div>

            <h2 className="mt-3 text-lg font-semibold text-text-primary">
              Stripe payout onboarding
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Paid packages can only be sold once Stripe confirms your connected
              account can receive payouts. Buyers still pay through ProjectXBidX,
              and your package sale payout is transferred to your Stripe account.
            </p>

            <div className="mt-4 grid gap-3 text-sm text-text-secondary sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-bg-warm px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-text-muted">
                  Stripe Account
                </p>
                <p className="mt-1 font-semibold text-text-primary">
                  {payoutAccount?.stripe_account_id
                    ? `${payoutAccount.stripe_account_id.slice(0, 18)}...`
                    : "Not connected"}
                </p>
              </div>
              <div className="rounded-lg bg-bg-warm px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-text-muted">
                  Details Submitted
                </p>
                <p className="mt-1 font-semibold text-text-primary">
                  {payoutAccount?.details_submitted ? "Yes" : "No"}
                </p>
              </div>
              <div className="rounded-lg bg-bg-warm px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-text-muted">
                  Charges Enabled
                </p>
                <p className="mt-1 font-semibold text-text-primary">
                  {payoutAccount?.charges_enabled ? "Yes" : "No"}
                </p>
              </div>
              <div className="rounded-lg bg-bg-warm px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-text-muted">
                  Payouts Enabled
                </p>
                <p className="mt-1 font-semibold text-text-primary">
                  {payoutAccount?.payouts_enabled ? "Yes" : "No"}
                </p>
              </div>
            </div>
          </div>

          <div className="lg:w-72">
            <PayoutOnboardingActions
              hasStripeAccount={Boolean(payoutAccount?.stripe_account_id)}
              isReady={isReady}
            />
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <LibraryBig className="mb-3 h-6 w-6 text-accent-light" />
          <p className="text-2xl font-bold text-text-primary">
            {formatMoney(totalSalesCents)}
          </p>
          <p className="text-sm text-text-muted">Package sales</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <WalletCards className="mb-3 h-6 w-6 text-secondary" />
          <p className="text-2xl font-bold text-text-primary">
            {formatMoney(totalPayoutCents)}
          </p>
          <p className="text-sm text-text-muted">Estimator payout value</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <WalletCards className="mb-3 h-6 w-6 text-green-600" />
          <p className="text-2xl font-bold text-text-primary">
            {formatMoney(paidOutCents)}
          </p>
          <p className="text-sm text-text-muted">Paid out</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Package Sale Payout Queue
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            This shows paid package purchases and payout status.
          </p>
        </div>

        {paidPurchases.length > 0 ? (
          <div className="divide-y divide-border">
            {paidPurchases.map((purchase) => (
              <div key={purchase.id} className="px-6 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-text-primary">
                      {purchase.estimate_packages?.title || "Estimate package"}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      Purchased {new Date(purchase.purchased_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      purchase.payout_status === "paid_out"
                        ? "bg-green-100 text-green-700"
                        : purchase.payout_status === "payout_failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {purchase.payout_status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 text-sm text-text-secondary sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-muted">
                      Sale Price
                    </p>
                    <p className="mt-1 font-medium text-text-primary">
                      {formatMoney(purchase.price_cents, purchase.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-muted">
                      Platform Fee
                    </p>
                    <p className="mt-1 font-medium text-text-primary">
                      {formatMoney(purchase.platform_fee_cents, purchase.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-muted">
                      Estimator Payout
                    </p>
                    <p className="mt-1 font-medium text-text-primary">
                      {formatMoney(
                        purchase.estimator_payout_cents,
                        purchase.currency
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-muted">
                      Transfer
                    </p>
                    <p className="mt-1 font-medium text-text-primary">
                      {purchase.stripe_transfer_id
                        ? `${purchase.stripe_transfer_id.slice(0, 18)}...`
                        : "Not issued"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-text-muted">
            No paid package sale activity yet.
          </div>
        )}
      </div>
    </div>
  );
}
