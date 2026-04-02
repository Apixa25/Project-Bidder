"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

  const { data: existingPool } = await supabase
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

  const { data: pool, error: poolError } = await supabase
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

  const { error: sessionUpdateError } = await supabase
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
