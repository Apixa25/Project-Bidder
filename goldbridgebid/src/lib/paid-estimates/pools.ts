import type {
  PaidEstimateClaimStatus,
  PaidEstimatePoolStatus,
  ProjectPaidEstimatePool,
} from "@/types/database";

export const PAID_ESTIMATE_AUTO_RELEASE_HOURS = 48;

type PoolLike = Pick<
  ProjectPaidEstimatePool,
  "is_enabled" | "status" | "max_paid_slots" | "claimed_paid_slots" | "funded_at"
>;

export const ACTIVE_PAID_ESTIMATE_POOL_STATUSES: PaidEstimatePoolStatus[] = [
  "active",
  "full",
  "closed_settling",
];

export const PAID_SLOT_CLAIM_STATUSES: PaidEstimateClaimStatus[] = [
  "paid_reserved",
  "payout_pending",
  "paid_out",
  "disputed",
];

export function getRemainingPaidSlots(pool: PoolLike | null | undefined) {
  if (!pool) {
    return 0;
  }

  return Math.max(0, pool.max_paid_slots - pool.claimed_paid_slots);
}

export function isPaidEstimatePoolFunded(pool: PoolLike | null | undefined) {
  return Boolean(pool?.is_enabled && pool?.funded_at);
}

export function isPaidEstimatePoolVisibleAsPaid(
  pool: PoolLike | null | undefined
) {
  return Boolean(
    pool &&
      pool.is_enabled &&
      ACTIVE_PAID_ESTIMATE_POOL_STATUSES.includes(pool.status) &&
      pool.funded_at
  );
}

export function isPaidEstimatePoolFull(pool: PoolLike | null | undefined) {
  if (!pool) {
    return false;
  }

  return pool.status === "full" || getRemainingPaidSlots(pool) === 0;
}

export function canProjectOfferPaidEstimateSlots(
  pool: PoolLike | null | undefined
) {
  return isPaidEstimatePoolVisibleAsPaid(pool) && !isPaidEstimatePoolFull(pool);
}

export function shouldBidClaimPaidSlot(options: {
  pool: PoolLike | null | undefined;
  isEligible: boolean;
}) {
  return options.isEligible && canProjectOfferPaidEstimateSlots(options.pool);
}

export function getPaidEstimatePayoutDueAt(submittedAt: Date | string = new Date()) {
  const date =
    submittedAt instanceof Date ? new Date(submittedAt) : new Date(submittedAt);

  date.setHours(date.getHours() + PAID_ESTIMATE_AUTO_RELEASE_HOURS);
  return date.toISOString();
}
