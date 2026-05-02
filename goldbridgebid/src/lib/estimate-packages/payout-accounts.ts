import type { EstimatorPayoutAccount } from "@/types/database";

export type EstimatorPayoutReadiness =
  | "not_started"
  | "onboarding_incomplete"
  | "restricted"
  | "ready";

type PayoutAccountLike = Pick<
  EstimatorPayoutAccount,
  "stripe_account_id" | "details_submitted" | "charges_enabled" | "payouts_enabled"
>;

export const ESTIMATOR_PAYOUT_READINESS_LABELS: Record<
  EstimatorPayoutReadiness,
  string
> = {
  not_started: "Not started",
  onboarding_incomplete: "Onboarding incomplete",
  restricted: "Restricted",
  ready: "Ready for package payouts",
};

export function getEstimatorPayoutReadiness(
  account: PayoutAccountLike | null | undefined
): EstimatorPayoutReadiness {
  if (!account?.stripe_account_id) {
    return "not_started";
  }

  if (account.charges_enabled && account.payouts_enabled) {
    return "ready";
  }

  if (!account.details_submitted) {
    return "onboarding_incomplete";
  }

  return "restricted";
}

export function isEstimatorReadyForPayouts(
  account: PayoutAccountLike | null | undefined
) {
  return getEstimatorPayoutReadiness(account) === "ready";
}
