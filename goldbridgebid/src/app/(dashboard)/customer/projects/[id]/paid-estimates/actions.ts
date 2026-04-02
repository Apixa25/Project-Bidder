"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";
import {
  calculatePaidEstimateSplit,
  calculatePoolFundingTotal,
} from "@/lib/paid-estimates/money";
import { getStripeServerClient, getSiteUrl } from "@/lib/stripe/server";
import type { PaidEstimateFilter } from "@/types/database";

export interface PaidEstimateCheckoutActionState {
  error: string | null;
  checkoutUrl: string | null;
}

const INITIAL_STATE: PaidEstimateCheckoutActionState = {
  error: null,
  checkoutUrl: null,
};

function parseFilter(value: FormDataEntryValue | null): PaidEstimateFilter {
  return value === "core_verified_only" ? "core_verified_only" : "open_to_anyone";
}

export async function createPaidEstimateCheckoutSession(
  prevState: PaidEstimateCheckoutActionState = INITIAL_STATE,
  formData: FormData
): Promise<PaidEstimateCheckoutActionState> {
  void prevState;
  const supabase = await createClient();
  const admin = createAdminClient();
  const stripe = getStripeServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", checkoutUrl: null };
  }

  if (!(await userHasRole(user.id, "customer"))) {
    return {
      error: "Enable customer mode to create paid estimate offers.",
      checkoutUrl: null,
    };
  }

  const projectId = ((formData.get("projectId") as string) || "").trim();
  const rewardAmountRaw = ((formData.get("rewardAmount") as string) || "").trim();
  const maxPaidSlotsRaw = ((formData.get("maxPaidSlots") as string) || "").trim();
  const filter = parseFilter(formData.get("filter"));

  if (!projectId) {
    return { error: "Missing project id.", checkoutUrl: null };
  }

  const rewardAmount = Number.parseFloat(rewardAmountRaw);
  const maxPaidSlots = Number.parseInt(maxPaidSlotsRaw, 10);

  if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
    return {
      error: "Enter a valid reward amount greater than zero.",
      checkoutUrl: null,
    };
  }

  if (!Number.isInteger(maxPaidSlots) || maxPaidSlots <= 0) {
    return {
      error: "Enter a valid number of paid slots.",
      checkoutUrl: null,
    };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, status, customer_id")
    .eq("id", projectId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (!project) {
    return { error: "Project not found.", checkoutUrl: null };
  }

  if (project.status !== "open") {
    return {
      error: "Only open projects can activate paid estimates.",
      checkoutUrl: null,
    };
  }

  const { data: existingPool } = await admin
    .from("project_paid_estimate_pools")
    .select("id, funded_at, status")
    .eq("project_id", projectId)
    .maybeSingle();

  if (existingPool?.funded_at && existingPool.status !== "funding_required") {
    return {
      error:
        "This project already has a live paid estimate pool. Editing live offers comes in a later phase.",
      checkoutUrl: null,
    };
  }

  const split = calculatePaidEstimateSplit(rewardAmount);
  const fundedTotalAmount = calculatePoolFundingTotal(rewardAmount, maxPaidSlots);

  const { data: pool, error: poolError } = await admin
    .from("project_paid_estimate_pools")
    .upsert(
      {
        project_id: projectId,
        is_enabled: false,
        filter,
        reward_amount: split.rewardAmount,
        contractor_payout_amount: split.contractorPayoutAmount,
        platform_fee_amount: split.platformFeeAmount,
        max_paid_slots: maxPaidSlots,
        funded_total_amount: fundedTotalAmount,
        claimed_paid_slots: 0,
        reserved_total_amount: 0,
        paid_out_total_amount: 0,
        refunded_total_amount: 0,
        status: "funding_required",
        funded_at: null,
        closed_at: null,
        stripe_payment_intent_id: null,
        stripe_checkout_session_id: null,
      },
      { onConflict: "project_id" }
    )
    .select("id")
    .single();

  if (poolError || !pool) {
    console.error("Create paid estimate pool error:", poolError);
    return {
      error: "Could not save the paid estimate offer right now.",
      checkoutUrl: null,
    };
  }

  const projectUrl = `${getSiteUrl()}/customer/projects/${projectId}`;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${projectUrl}?paidEstimateCheckout=success`,
    cancel_url: `${projectUrl}?paidEstimateCheckout=cancelled`,
    metadata: {
      customerId: user.id,
      projectId,
      poolId: pool.id,
    },
    payment_intent_data: {
      metadata: {
        customerId: user.id,
        projectId,
        poolId: pool.id,
      },
    },
    line_items: [
      {
        quantity: maxPaidSlots,
        price_data: {
          currency: "usd",
          unit_amount: split.rewardAmountCents,
          product_data: {
            name: `Paid estimate slot for ${project.title}`,
            description:
              filter === "core_verified_only"
                ? "Project-wide paid estimate slot for core-verified contractors."
                : "Project-wide paid estimate slot open to any contractor.",
          },
        },
      },
    ],
  });

  const { error: sessionUpdateError } = await admin
    .from("project_paid_estimate_pools")
    .update({
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
    })
    .eq("id", pool.id);

  if (sessionUpdateError) {
    console.error("Update paid estimate checkout session error:", sessionUpdateError);
  }

  revalidatePath(`/customer/projects/${projectId}`);

  return {
    error: null,
    checkoutUrl: session.url ?? null,
  };
}

export async function openPaidEstimateDispute(
  claimId: string,
  reason:
    | "blank_or_spam"
    | "wrong_trade"
    | "duplicate_submission"
    | "abusive_or_irrelevant"
    | "not_qualified_at_submission",
  customerMessage: string
) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to manage paid estimate disputes." };
  }

  const { data: claim } = await admin
    .from("paid_estimate_claims")
    .select("*, projects!inner(customer_id)")
    .eq("id", claimId)
    .single();

  if (!claim) {
    return { error: "Claim not found." };
  }

  const projectOwnerId = (
    claim.projects as unknown as { customer_id: string }
  ).customer_id;

  if (projectOwnerId !== user.id) {
    return { error: "You can only dispute claims on your own projects." };
  }

  if (claim.claim_status !== "paid_reserved") {
    return {
      error: "Only reserved paid estimates can be disputed at this stage.",
    };
  }

  const reservedAt = claim.reserved_at || claim.created_at;
  const reservedAtTime = new Date(reservedAt).getTime();
  const disputeDeadline = reservedAtTime + 48 * 60 * 60 * 1000;
  if (Date.now() > disputeDeadline) {
    return {
      error:
        "The 48-hour dispute window has passed for this paid estimate claim.",
    };
  }

  const { data: existingDispute } = await admin
    .from("paid_estimate_disputes")
    .select("id")
    .eq("claim_id", claimId)
    .maybeSingle();

  if (existingDispute) {
    return { error: "A dispute has already been opened for this claim." };
  }

  const { error: insertError } = await admin
    .from("paid_estimate_disputes")
    .insert({
      claim_id: claim.id,
      project_id: claim.project_id,
      bid_id: claim.bid_id,
      customer_id: user.id,
      bidder_id: claim.bidder_id,
      reason,
      customer_message: customerMessage || null,
      review_status: "open",
    });

  if (insertError) {
    console.error("Open paid estimate dispute error:", insertError);
    return { error: "Could not open the dispute right now." };
  }

  await admin
    .from("paid_estimate_claims")
    .update({ claim_status: "disputed" })
    .eq("id", claim.id);

  await supabase.from("notifications").insert({
    user_id: claim.bidder_id,
    type: "paid_estimate_disputed",
    title: "A paid estimate was disputed",
    message:
      "The project owner opened a dispute on your paid estimate. Our team will review it.",
    link: "/bidder/bids",
  });

  revalidatePath(`/customer/projects/${claim.project_id}`);
  revalidatePath("/admin/disputes");
  revalidatePath(`/admin/projects/${claim.project_id}`);
  return { success: true };
}
