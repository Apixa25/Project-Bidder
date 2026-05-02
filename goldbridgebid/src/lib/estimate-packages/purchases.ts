import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

interface StripePackageMetadata {
  packageId?: string | null;
  packageVersionId?: string | null;
  buyerId?: string | null;
  sellerId?: string | null;
  priceCents?: string | null;
  currency?: string | null;
}

interface StripeIds {
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
}

export const ESTIMATE_PACKAGE_PLATFORM_FEE_RATE = 0.1;

function parsePriceCents(value: string | null | undefined) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function calculateEstimatePackageSaleSplit(priceCents: number) {
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    throw new Error("Package price must be a non-negative integer cent amount.");
  }

  const platformFeeCents = Math.round(
    priceCents * ESTIMATE_PACKAGE_PLATFORM_FEE_RATE
  );
  const estimatorPayoutCents = priceCents - platformFeeCents;

  return {
    platformFeeCents,
    estimatorPayoutCents,
  };
}

export async function markEstimatePackagePurchased(options: {
  admin: AdminClient;
  metadata: StripePackageMetadata;
  stripeIds: StripeIds;
}) {
  const { admin, metadata, stripeIds } = options;
  const packageId = metadata.packageId || null;
  const packageVersionId = metadata.packageVersionId || null;
  const buyerId = metadata.buyerId || null;
  const sellerId = metadata.sellerId || null;
  const priceCents = parsePriceCents(metadata.priceCents);
  const currency = (metadata.currency || "usd").toLowerCase();

  if (!packageId || !packageVersionId || !buyerId || !sellerId || !priceCents) {
    return { success: false, reason: "missing_metadata" as const };
  }

  const { data: packageRow } = await admin
    .from("estimate_packages")
    .select("id, estimator_id, status, current_version_id, price_cents, currency")
    .eq("id", packageId)
    .maybeSingle();

  if (
    !packageRow ||
    packageRow.status !== "published" ||
    packageRow.estimator_id !== sellerId ||
    packageRow.current_version_id !== packageVersionId ||
    Number(packageRow.price_cents) !== priceCents
  ) {
    return { success: false, reason: "package_mismatch" as const };
  }

  const { data: existingPurchase } = await admin
    .from("estimate_package_purchases")
    .select("id, stripe_checkout_session_id, stripe_payment_intent_id, payout_status, paid_out_at, stripe_transfer_id")
    .eq("package_version_id", packageVersionId)
    .eq("buyer_id", buyerId)
    .maybeSingle();
  const { platformFeeCents, estimatorPayoutCents } =
    calculateEstimatePackageSaleSplit(priceCents);

  const purchasePayload = {
    package_id: packageId,
    package_version_id: packageVersionId,
    buyer_id: buyerId,
    seller_id: sellerId,
    price_cents: priceCents,
    currency,
    platform_fee_cents: platformFeeCents,
    estimator_payout_cents: estimatorPayoutCents,
    payout_status:
      existingPurchase?.payout_status === "paid_out"
        ? existingPurchase.payout_status
        : ("payout_pending" as const),
    payout_available_at: new Date().toISOString(),
    paid_out_at: existingPurchase?.paid_out_at ?? null,
    stripe_transfer_id: existingPurchase?.stripe_transfer_id ?? null,
    stripe_checkout_session_id:
      stripeIds.checkoutSessionId ??
      existingPurchase?.stripe_checkout_session_id ??
      null,
    stripe_payment_intent_id:
      stripeIds.paymentIntentId ??
      existingPurchase?.stripe_payment_intent_id ??
      null,
  };

  const { error: purchaseError } = existingPurchase
    ? await admin
        .from("estimate_package_purchases")
        .update(purchasePayload)
        .eq("id", existingPurchase.id)
    : await admin.from("estimate_package_purchases").insert(purchasePayload);

  if (purchaseError) {
    console.error("Estimate package purchase fulfillment error:", purchaseError);
    return { success: false, reason: "insert_failed" as const };
  }

  if (!existingPurchase) {
    await Promise.all([
      admin.from("notifications").insert({
        user_id: buyerId,
        type: "estimate_package_purchased",
        title: "Estimate package unlocked",
        message: "Your estimate package purchase is complete and files are ready.",
        link: `/estimate-packages/${packageId}`,
      }),
      admin.from("notifications").insert({
        user_id: sellerId,
        type: "estimate_package_sold",
        title: "Estimate package sold",
        message: "A buyer purchased one of your estimate packages.",
        link: `/estimator/packages/${packageId}`,
      }),
    ]);
  }

  revalidatePath("/estimate-packages");
  revalidatePath(`/estimate-packages/${packageId}`);
  revalidatePath(`/estimator/packages/${packageId}`);
  revalidatePath("/estimator/payouts");

  return { success: true, packageId, buyerId, sellerId } as const;
}

export async function reconcileEstimatePackagePurchaseFromCheckoutSession(options: {
  admin: AdminClient;
  stripe: Stripe;
  sessionId: string;
  packageId: string;
  buyerId: string;
}) {
  const { admin, stripe, sessionId, packageId, buyerId } = options;
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (
    session.metadata?.kind !== "estimate_package_purchase" ||
    session.metadata.packageId !== packageId ||
    session.metadata.buyerId !== buyerId ||
    session.payment_status !== "paid"
  ) {
    return { success: false, reason: "session_not_paid_or_mismatch" as const };
  }

  return markEstimatePackagePurchased({
    admin,
    metadata: session.metadata,
    stripeIds: {
      checkoutSessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
    },
  });
}

