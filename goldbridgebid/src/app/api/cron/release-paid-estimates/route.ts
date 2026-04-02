import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { shouldAutoReleasePaidEstimateClaim } from "@/lib/paid-estimates/settlement";
import type {
  PaidEstimateClaim,
  Project,
} from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleRequest(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: dueClaims } = await admin
    .from("paid_estimate_claims")
    .select("*")
    .eq("claim_status", "paid_reserved")
    .lte("payout_due_at", nowIso)
    .is("paid_out_at", null)
    .limit(100);

  const claimsById = new Map<string, PaidEstimateClaim>();
  for (const claim of dueClaims || []) {
    claimsById.set(claim.id, claim as PaidEstimateClaim);
  }

  const projectIds = [...new Set([...claimsById.values()].map((claim) => claim.project_id))];
  const { data: projectRows } = projectIds.length
    ? await admin
        .from("projects")
        .select("id, customer_id")
        .in("id", projectIds)
    : { data: [] };
  const projectMap = new Map(
    ((projectRows || []) as Pick<Project, "id" | "customer_id">[]).map((project) => [
      project.id,
      project,
    ])
  );

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const claim of claimsById.values()) {
    if (!shouldAutoReleasePaidEstimateClaim(claim, now)) {
      skipped += 1;
      continue;
    }

    const { data: updatedClaim, error: claimUpdateError } = await admin
      .from("paid_estimate_claims")
      .update({
        claim_status: "payout_pending",
      })
      .eq("id", claim.id)
      .eq("claim_status", "paid_reserved")
      .is("paid_out_at", null)
      .select("id, project_id, bidder_id")
      .maybeSingle();

    if (claimUpdateError) {
      console.error("Paid estimate release claim update error:", claimUpdateError);
      errors += 1;
      continue;
    }

    if (!updatedClaim) {
      skipped += 1;
      continue;
    }

    const project = projectMap.get(updatedClaim.project_id);
    const notifications = [
      {
        user_id: updatedClaim.bidder_id,
        type: "paid_estimate_payout_pending",
        title: "Paid estimate approved for payout",
        message:
          "Your paid estimate cleared the review window and is now queued for payout.",
        link: "/bidder/bids",
      },
    ];

    if (project?.customer_id) {
      notifications.push({
        user_id: project.customer_id,
        type: "paid_estimate_payout_pending",
        title: "Paid estimate approved for payout",
        message:
          "A paid estimate on your project completed the review window and is now queued for payout.",
        link: `/customer/projects/${updatedClaim.project_id}`,
      });
    }

    await admin.from("notifications").insert(notifications);

    processed += 1;
  }

  return NextResponse.json({
    ok: true,
    processed,
    skipped,
    errors,
  });
}

export { handleRequest as GET, handleRequest as POST };
