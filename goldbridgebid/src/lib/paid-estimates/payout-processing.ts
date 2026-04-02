import type {
  PaidEstimateClaim,
  ProjectPaidEstimatePool,
} from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type PayoutClaimLike = Pick<
  PaidEstimateClaim,
  | "id"
  | "project_id"
  | "bidder_id"
  | "pool_id"
  | "reward_amount"
  | "claim_status"
>;

export async function markPaidEstimateClaimPaidOut(options: {
  admin: AdminClient;
  claim: PayoutClaimLike;
  paidOutAt?: string;
  stripeTransferId?: string | null;
}) {
  const {
    admin,
    claim,
    paidOutAt = new Date().toISOString(),
    stripeTransferId = null,
  } = options;

  if (!claim.pool_id || !claim.reward_amount) {
    return { error: "Claim does not have a reserved paid amount." } as const;
  }

  const { data: updatedClaim, error: claimUpdateError } = await admin
    .from("paid_estimate_claims")
    .update({
      claim_status: "paid_out",
      paid_out_at: paidOutAt,
      stripe_transfer_id: stripeTransferId,
    })
    .eq("id", claim.id)
    .eq("claim_status", claim.claim_status)
    .is("paid_out_at", null)
    .select("*")
    .maybeSingle();

  if (claimUpdateError) {
    return { error: "Failed to mark claim as paid out." } as const;
  }

  if (!updatedClaim) {
    return { error: "Claim was already settled elsewhere." } as const;
  }

  const { data: poolRow } = await admin
    .from("project_paid_estimate_pools")
    .select("*")
    .eq("id", claim.pool_id)
    .maybeSingle();

  const pool = (poolRow || null) as ProjectPaidEstimatePool | null;

  if (!pool) {
    return { error: "Pool not found for this claim." } as const;
  }

  const rewardAmount = Number(claim.reward_amount);
  const { error: poolUpdateError } = await admin
    .from("project_paid_estimate_pools")
    .update({
      reserved_total_amount: Math.max(
        0,
        Number(pool.reserved_total_amount) - rewardAmount
      ),
      paid_out_total_amount: Number(pool.paid_out_total_amount) + rewardAmount,
      status:
        pool.status === "closed_settling" &&
        Math.max(0, Number(pool.reserved_total_amount) - rewardAmount) === 0
          ? "closed_refunded"
          : pool.status,
    })
    .eq("id", pool.id);

  if (poolUpdateError) {
    return { error: "Failed to update pool payout totals." } as const;
  }

  return {
    success: true,
    updatedClaim: updatedClaim as PaidEstimateClaim,
  } as const;
}
