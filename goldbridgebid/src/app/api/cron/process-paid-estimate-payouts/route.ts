import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { dollarsToCents } from "@/lib/paid-estimates/money";
import { isBidderReadyForPayouts } from "@/lib/paid-estimates/payout-accounts";
import { markPaidEstimateClaimPaidOut } from "@/lib/paid-estimates/payout-processing";
import { getStripeServerClient } from "@/lib/stripe/server";
import type {
  BidderPayoutAccount,
  PaidEstimateClaim,
  Project,
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
          "Stripe is not configured yet. Add live Stripe secrets before running payout processing.",
      },
      { status: 503 }
    );
  }

  const admin = createAdminClient();

  const { data: claimRows } = await admin
    .from("paid_estimate_claims")
    .select("*")
    .eq("claim_status", "payout_pending")
    .is("paid_out_at", null)
    .limit(100);

  const claims = (claimRows || []) as PaidEstimateClaim[];
  const bidderIds = [...new Set(claims.map((claim) => claim.bidder_id))];
  const projectIds = [...new Set(claims.map((claim) => claim.project_id))];

  const [{ data: payoutRows }, { data: projectRows }] = await Promise.all([
    bidderIds.length
      ? admin
          .from("bidder_payout_accounts")
          .select("*")
          .in("user_id", bidderIds)
      : Promise.resolve({ data: [] }),
    projectIds.length
      ? admin
          .from("projects")
          .select("id, customer_id, title")
          .in("id", projectIds)
      : Promise.resolve({ data: [] }),
  ]);

  const payoutMap = new Map(
    ((payoutRows || []) as BidderPayoutAccount[]).map((account) => [
      account.user_id,
      account,
    ])
  );
  const projectMap = new Map(
    ((projectRows || []) as Pick<Project, "id" | "customer_id" | "title">[]).map(
      (project) => [project.id, project]
    )
  );

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const claim of claims) {
    const payoutAccount = payoutMap.get(claim.bidder_id) || null;

    if (
      !payoutAccount ||
      !payoutAccount.stripe_account_id ||
      !isBidderReadyForPayouts(payoutAccount) ||
      !claim.contractor_payout_amount
    ) {
      skipped += 1;
      continue;
    }

    try {
      const transferAmountCents = dollarsToCents(
        Number(claim.contractor_payout_amount)
      );

      const transfer = await stripe.transfers.create(
        {
          amount: transferAmountCents,
          currency: "usd",
          destination: payoutAccount.stripe_account_id,
          transfer_group: `paid_estimate:${claim.project_id}`,
          metadata: {
            claimId: claim.id,
            projectId: claim.project_id,
            bidderId: claim.bidder_id,
            bidId: claim.bid_id,
          },
        },
        {
          idempotencyKey: `paid-estimate-transfer:${claim.id}:${transferAmountCents}`,
        }
      );

      const payoutResult = await markPaidEstimateClaimPaidOut({
        admin,
        claim,
        stripeTransferId: transfer.id,
      });

      if ("error" in payoutResult) {
        console.error("Paid estimate payout finalization error:", payoutResult.error);
        errors += 1;
        continue;
      }

      const project = projectMap.get(claim.project_id);
      const notifications = [
        {
          user_id: claim.bidder_id,
          type: "paid_estimate_paid_out",
          title: "Paid estimate paid out",
          message:
            "Your paid estimate payout was released through the platform payout flow.",
          link: "/bidder/payouts",
        },
      ];

      if (project?.customer_id) {
        notifications.push({
          user_id: project.customer_id,
          type: "paid_estimate_paid_out",
          title: "Paid estimate paid out",
          message: `A paid estimate on "${project.title}" was paid out to the contractor.`,
          link: `/customer/projects/${claim.project_id}`,
        });
      }

      await admin.from("notifications").insert(notifications);
      processed += 1;
    } catch (error) {
      console.error("Paid estimate payout processing error:", error);
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
