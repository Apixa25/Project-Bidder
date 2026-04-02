import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { dollarsToCents } from "@/lib/paid-estimates/money";
import {
  getAvailablePaidEstimateRefundAmount,
  shouldClosePaidEstimatePoolForRefunds,
} from "@/lib/paid-estimates/settlement";
import { getStripeServerClient } from "@/lib/stripe/server";
import type { Project, ProjectPaidEstimatePool } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleRequest(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const admin = createAdminClient();
  const stripe = getStripeServerClient();
  const nowIso = new Date().toISOString();

  const { data: poolRows } = await admin
    .from("project_paid_estimate_pools")
    .select("*")
    .neq("status", "closed_refunded")
    .not("funded_at", "is", null)
    .limit(100);

  const pools = ((poolRows || []) as ProjectPaidEstimatePool[]).filter(
    (pool) => pool.funded_at
  );

  const projectIds = [...new Set(pools.map((pool) => pool.project_id))];
  const { data: projectRows } = projectIds.length
    ? await admin
        .from("projects")
        .select("id, customer_id, status")
        .in("id", projectIds)
    : { data: [] };

  const projectMap = new Map(
    ((projectRows || []) as Pick<Project, "id" | "customer_id" | "status">[]).map(
      (project) => [project.id, project]
    )
  );

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const pool of pools) {
    const project = projectMap.get(pool.project_id);

    if (!project || !shouldClosePaidEstimatePoolForRefunds(project.status)) {
      skipped += 1;
      continue;
    }

    const refundableAmount = getAvailablePaidEstimateRefundAmount(pool);
    const reservedTotalAmount = Number(pool.reserved_total_amount);
    const nextStatus =
      reservedTotalAmount > 0 ? "closed_settling" : "closed_refunded";

    if (refundableAmount <= 0) {
      const { error: statusUpdateError } = await admin
        .from("project_paid_estimate_pools")
        .update({
          is_enabled: false,
          status: nextStatus,
          closed_at: pool.closed_at ?? nowIso,
        })
        .eq("id", pool.id);

      if (statusUpdateError) {
        console.error("Paid estimate close-without-refund error:", statusUpdateError);
        errors += 1;
      } else {
        processed += 1;
      }
      continue;
    }

    if (!pool.stripe_payment_intent_id) {
      console.error(
        "Cannot refund paid estimate pool without Stripe payment intent:",
        pool.id
      );
      errors += 1;
      continue;
    }

    try {
      const refundAmountCents = dollarsToCents(refundableAmount);

      await stripe.refunds.create(
        {
          payment_intent: pool.stripe_payment_intent_id,
          amount: refundAmountCents,
          metadata: {
            projectId: pool.project_id,
            poolId: pool.id,
            reason: "unused_paid_estimate_balance",
          },
        },
        {
          idempotencyKey: `paid-estimate-refund:${pool.id}:${refundAmountCents}:${Number(
            pool.refunded_total_amount
          )}`,
        }
      );

      const { error: poolUpdateError } = await admin
        .from("project_paid_estimate_pools")
        .update({
          is_enabled: false,
          refunded_total_amount:
            Number(pool.refunded_total_amount) + refundableAmount,
          status: nextStatus,
          closed_at: pool.closed_at ?? nowIso,
        })
        .eq("id", pool.id);

      if (poolUpdateError) {
        console.error("Paid estimate refund pool update error:", poolUpdateError);
        errors += 1;
        continue;
      }

      await admin.from("notifications").insert({
        user_id: project.customer_id,
        type: "paid_estimate_unused_funds_refunded",
        title: "Unused paid estimate funds refunded",
        message:
          "Your project's unused paid estimate balance was refunded after the project stopped accepting new paid claims.",
        link: `/customer/projects/${pool.project_id}`,
      });

      processed += 1;
    } catch (error) {
      console.error("Paid estimate refund error:", error);
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
