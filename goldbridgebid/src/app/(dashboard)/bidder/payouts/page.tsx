import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import {
  BIDDER_PAYOUT_READINESS_LABELS,
  getBidderPayoutReadiness,
  isBidderReadyForPayouts,
} from "@/lib/paid-estimates/payout-accounts";
import type {
  BidderPayoutAccount,
  PaidEstimateClaim,
} from "@/types/database";
import { userHasRole } from "@/lib/auth/roles";
import PayoutOnboardingActions from "./PayoutOnboardingActions";

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function BidderPayoutsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const { data: payoutAccountRow } = await admin
    .from("bidder_payout_accounts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const payoutAccount =
    (payoutAccountRow as BidderPayoutAccount | null | undefined) || null;
  const readiness = getBidderPayoutReadiness(payoutAccount);
  const isReady = isBidderReadyForPayouts(payoutAccount);

  const { data: claimsRaw } = await admin
    .from("paid_estimate_claims")
    .select("*, projects!inner(title)")
    .eq("bidder_id", user.id)
    .in("claim_status", [
      "paid_reserved",
      "payout_pending",
      "paid_out",
      "disputed",
      "payout_denied_refunded",
    ])
    .order("created_at", { ascending: false });

  const claims = (claimsRaw || []) as (PaidEstimateClaim & {
    projects: { title: string };
  })[];

  const pendingQueueCount = claims.filter(
    (claim) => claim.claim_status === "payout_pending"
  ).length;

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
          <h1 className="text-2xl font-bold text-text-primary">Payouts 💸</h1>
          <p className="mt-1 text-text-secondary">
            Manage payout readiness for paid estimates and review your payout
            queue.
          </p>
        </div>
        <Link
          href="/bidder/bids"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
        >
          View My Bids
        </Link>
      </div>

      {stripeConnectMessage && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
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
                {BIDDER_PAYOUT_READINESS_LABELS[readiness]}
              </span>
              {pendingQueueCount > 0 && (
                <span className="rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-semibold text-secondary">
                  {pendingQueueCount} payout{pendingQueueCount === 1 ? "" : "s"} queued
                </span>
              )}
            </div>

            <h2 className="mt-3 text-lg font-semibold text-text-primary">
              Stripe payout onboarding
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Paid estimates move into a payout queue after the customer review
              window. To receive real payouts later, your Stripe Connect account
              needs onboarding and payout capability enabled.
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

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Paid Estimate Claim Queue
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            This shows the paid-estimate states tied to your bids.
          </p>
        </div>

        {claims.length > 0 ? (
          <div className="divide-y divide-border">
            {claims.map((claim) => (
              <div key={claim.id} className="px-6 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-text-primary">
                      {claim.projects?.title || "Project"}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      Claim created {new Date(claim.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      claim.claim_status === "paid_out"
                        ? "bg-green-100 text-green-700"
                        : claim.claim_status === "payout_pending"
                          ? "bg-blue-100 text-blue-700"
                          : claim.claim_status === "disputed"
                            ? "bg-amber-100 text-amber-800"
                            : claim.claim_status === "payout_denied_refunded"
                              ? "bg-red-100 text-red-700"
                              : "bg-primary/10 text-primary"
                    }`}
                  >
                    {claim.claim_status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 text-sm text-text-secondary sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-muted">
                      Reward
                    </p>
                    <p className="mt-1 font-medium text-text-primary">
                      {claim.reward_amount
                        ? `$${Number(claim.reward_amount).toLocaleString()}`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-muted">
                      Reserved At
                    </p>
                    <p className="mt-1 font-medium text-text-primary">
                      {claim.reserved_at
                        ? new Date(claim.reserved_at).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-muted">
                      Payout Due
                    </p>
                    <p className="mt-1 font-medium text-text-primary">
                      {claim.payout_due_at
                        ? new Date(claim.payout_due_at).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-muted">
                      Paid Out
                    </p>
                    <p className="mt-1 font-medium text-text-primary">
                      {claim.paid_out_at
                        ? new Date(claim.paid_out_at).toLocaleString()
                        : "Not yet"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-muted">
                      Transfer
                    </p>
                    <p className="mt-1 font-medium text-text-primary">
                      {claim.stripe_transfer_id
                        ? `${claim.stripe_transfer_id.slice(0, 18)}...`
                        : "Not issued"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-text-muted">
            No paid estimate claim activity yet.
          </div>
        )}
      </div>
    </div>
  );
}
