import type { EstimatePackagePurchase } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type PackagePayoutPurchaseLike = Pick<
  EstimatePackagePurchase,
  | "id"
  | "package_id"
  | "package_version_id"
  | "seller_id"
  | "estimator_payout_cents"
  | "payout_status"
>;

export async function markEstimatePackagePurchasePaidOut(options: {
  admin: AdminClient;
  purchase: PackagePayoutPurchaseLike;
  paidOutAt?: string;
  stripeTransferId?: string | null;
}) {
  const {
    admin,
    purchase,
    paidOutAt = new Date().toISOString(),
    stripeTransferId = null,
  } = options;

  if (!purchase.estimator_payout_cents) {
    return { error: "Purchase does not have an estimator payout amount." } as const;
  }

  const { data: updatedPurchase, error: purchaseUpdateError } = await admin
    .from("estimate_package_purchases")
    .update({
      payout_status: "paid_out",
      paid_out_at: paidOutAt,
      stripe_transfer_id: stripeTransferId,
    })
    .eq("id", purchase.id)
    .eq("payout_status", purchase.payout_status)
    .is("paid_out_at", null)
    .select("*")
    .maybeSingle();

  if (purchaseUpdateError) {
    return { error: "Failed to mark package purchase as paid out." } as const;
  }

  if (!updatedPurchase) {
    return { error: "Purchase payout was already settled elsewhere." } as const;
  }

  return {
    success: true,
    updatedPurchase: updatedPurchase as EstimatePackagePurchase,
  } as const;
}
