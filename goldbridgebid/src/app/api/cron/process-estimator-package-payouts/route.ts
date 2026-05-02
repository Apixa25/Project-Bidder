import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { isEstimatorReadyForPayouts } from "@/lib/estimate-packages/payout-accounts";
import { markEstimatePackagePurchasePaidOut } from "@/lib/estimate-packages/payout-processing";
import { getStripeServerClient } from "@/lib/stripe/server";
import type {
  EstimatePackage,
  EstimatePackagePurchase,
  EstimatorPayoutAccount,
} from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleRequest(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "Unauthorized cron request." },
      { status: 401 }
    );
  }

  let stripe;
  try {
    stripe = getStripeServerClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured yet. Add live Stripe secrets before running estimator package payout processing.",
      },
      { status: 503 }
    );
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: purchaseRows } = await admin
    .from("estimate_package_purchases")
    .select("*")
    .eq("payout_status", "payout_pending")
    .is("paid_out_at", null)
    .lte("payout_available_at", nowIso)
    .limit(100);

  const purchases = (purchaseRows || []) as EstimatePackagePurchase[];
  const sellerIds = [...new Set(purchases.map((purchase) => purchase.seller_id))];
  const packageIds = [...new Set(purchases.map((purchase) => purchase.package_id))];

  const [{ data: payoutRows }, { data: packageRows }] = await Promise.all([
    sellerIds.length
      ? admin
          .from("estimator_payout_accounts")
          .select("*")
          .in("user_id", sellerIds)
      : Promise.resolve({ data: [] }),
    packageIds.length
      ? admin
          .from("estimate_packages")
          .select("id, title")
          .in("id", packageIds)
      : Promise.resolve({ data: [] }),
  ]);

  const payoutMap = new Map(
    ((payoutRows || []) as EstimatorPayoutAccount[]).map((account) => [
      account.user_id,
      account,
    ])
  );
  const packageMap = new Map(
    ((packageRows || []) as Pick<EstimatePackage, "id" | "title">[]).map(
      (packageRow) => [packageRow.id, packageRow]
    )
  );

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const purchase of purchases) {
    const payoutAccount = payoutMap.get(purchase.seller_id) || null;

    if (
      !payoutAccount ||
      !payoutAccount.stripe_account_id ||
      !isEstimatorReadyForPayouts(payoutAccount) ||
      !purchase.estimator_payout_cents
    ) {
      skipped += 1;
      continue;
    }

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: purchase.estimator_payout_cents,
          currency: purchase.currency || "usd",
          destination: payoutAccount.stripe_account_id,
          transfer_group: `estimate_package:${purchase.package_id}`,
          metadata: {
            purchaseId: purchase.id,
            packageId: purchase.package_id,
            packageVersionId: purchase.package_version_id,
            sellerId: purchase.seller_id,
            buyerId: purchase.buyer_id,
          },
        },
        {
          idempotencyKey: `estimate-package-transfer:${purchase.id}:${purchase.estimator_payout_cents}`,
        }
      );

      const payoutResult = await markEstimatePackagePurchasePaidOut({
        admin,
        purchase,
        stripeTransferId: transfer.id,
      });

      if ("error" in payoutResult) {
        console.error("Estimate package payout finalization error:", payoutResult.error);
        errors += 1;
        continue;
      }

      const packageRow = packageMap.get(purchase.package_id);
      await admin.from("notifications").insert({
        user_id: purchase.seller_id,
        type: "estimate_package_paid_out",
        title: "Estimate package payout sent",
        message: packageRow?.title
          ? `Your payout for "${packageRow.title}" was sent through Stripe.`
          : "Your estimate package payout was sent through Stripe.",
        link: "/estimator/payouts",
      });

      processed += 1;
    } catch (error) {
      console.error("Estimate package payout processing error:", error);
      errors += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    skipped,
    errors,
  });
}

export { handleRequest as GET, handleRequest as POST };
