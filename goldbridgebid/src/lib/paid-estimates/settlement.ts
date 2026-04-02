import type {
  PaidEstimateClaim,
  ProjectPaidEstimatePool,
  ProjectStatus,
} from "@/types/database";
import { roundCurrency } from "./money";

type ClaimSettlementCandidate = Pick<
  PaidEstimateClaim,
  "claim_status" | "payout_due_at" | "paid_out_at"
>;

type RefundablePoolLike = Pick<
  ProjectPaidEstimatePool,
  | "funded_total_amount"
  | "reserved_total_amount"
  | "paid_out_total_amount"
  | "refunded_total_amount"
>;

export function shouldAutoReleasePaidEstimateClaim(
  claim: ClaimSettlementCandidate,
  now: Date = new Date()
) {
  if (
    claim.claim_status !== "paid_reserved" ||
    !claim.payout_due_at ||
    claim.paid_out_at
  ) {
    return false;
  }

  return new Date(claim.payout_due_at).getTime() <= now.getTime();
}

export function shouldFinalizePendingPaidEstimateClaim(
  claim: ClaimSettlementCandidate
) {
  return claim.claim_status === "payout_pending" && !claim.paid_out_at;
}

export function getAvailablePaidEstimateRefundAmount(
  pool: RefundablePoolLike
) {
  return roundCurrency(
    Math.max(
      0,
      Number(pool.funded_total_amount) -
        Number(pool.reserved_total_amount) -
        Number(pool.paid_out_total_amount) -
        Number(pool.refunded_total_amount)
    )
  );
}

export function shouldClosePaidEstimatePoolForRefunds(projectStatus: ProjectStatus) {
  return projectStatus === "awarded" || projectStatus === "closed";
}
