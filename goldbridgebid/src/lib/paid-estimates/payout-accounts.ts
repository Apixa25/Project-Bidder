import type { BidderPayoutAccount } from "@/types/database";

export type BidderPayoutReadiness =
  | "not_started"
  | "onboarding_incomplete"
  | "restricted"
  | "ready";

type PayoutAccountLike = Pick<
  BidderPayoutAccount,
  "stripe_account_id" | "details_submitted" | "charges_enabled" | "payouts_enabled"
>;

export const BIDDER_PAYOUT_READINESS_LABELS: Record<
  BidderPayoutReadiness,
  string
> = {
  not_started: "Not started",
  onboarding_incomplete: "Onboarding incomplete",
  restricted: "Restricted",
  ready: "Ready for payouts",
};

export function getBidderPayoutReadiness(
  account: PayoutAccountLike | null | undefined
): BidderPayoutReadiness {
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

export function isBidderReadyForPayouts(
  account: PayoutAccountLike | null | undefined
) {
  return getBidderPayoutReadiness(account) === "ready";
}
