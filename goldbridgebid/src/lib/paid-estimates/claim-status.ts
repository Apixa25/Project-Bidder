import type { PaidEstimateClaimStatus } from "@/types/database";

// Human-friendly labels + plain-English descriptions for the
// `paid_estimate_claims.claim_status` enum. Keep this in one place so the
// bidder dashboard, bidder bids page, admin views, and emails all read the
// same way. The previous version of the bidder/bids page rendered the raw
// enum via `claim_status.replace(/_/g, " ")` which produced strings like
// "payout pending" and "payout denied refunded" — accurate but ugly.

export const PAID_ESTIMATE_CLAIM_STATUS_LABELS: Record<
  PaidEstimateClaimStatus,
  string
> = {
  unpaid_bid: "Unpaid Slot",
  paid_reserved: "Reserved",
  payout_pending: "Payout Queued",
  paid_out: "Paid Out",
  disputed: "Disputed",
  payout_denied_refunded: "Denied & Refunded",
};

export const PAID_ESTIMATE_CLAIM_STATUS_DESCRIPTIONS: Record<
  PaidEstimateClaimStatus,
  string
> = {
  unpaid_bid:
    "Your bid was submitted but didn't claim a paid slot — usually because all slots were already claimed when you submitted, or you weren't eligible at the time.",
  paid_reserved:
    "You've claimed a paid slot. The reward auto-pays after a short review window unless the customer raises a dispute.",
  payout_pending:
    "The review window has closed and your payout is queued. It moves to Paid Out as soon as Stripe processes the next payout batch.",
  paid_out:
    "The reward has been sent to your Stripe payout account. 🎉",
  disputed:
    "The customer raised a dispute about this bid. Admin will review the dispute and decide whether to approve or refund.",
  payout_denied_refunded:
    "The dispute was resolved against this bid, so the customer was refunded and no payout was sent.",
};

export function getPaidEstimateClaimStatusLabel(
  status: PaidEstimateClaimStatus | string | null | undefined
): string {
  if (!status) return "Unknown";
  const map = PAID_ESTIMATE_CLAIM_STATUS_LABELS as Record<string, string>;
  return (
    map[status as string] ??
    // Fallback: title-case the underscored enum value so unknown future
    // statuses still render readably instead of crashing.
    String(status)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
