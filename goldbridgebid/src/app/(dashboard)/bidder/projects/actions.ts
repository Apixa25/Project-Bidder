"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import {
  getPaidEstimateEligibility,
} from "@/lib/paid-estimates/eligibility";
import {
  getPaidEstimatePayoutDueAt,
  getRemainingPaidSlots,
  isPaidEstimatePoolVisibleAsPaid,
} from "@/lib/paid-estimates/pools";
import { reconcilePaidEstimatePoolFunding } from "@/lib/paid-estimates/funding";
import type {
  TradeCategory,
  ProjectPaidEstimatePool,
  PaidEstimateClaimStatus,
  BidderCredentials,
} from "@/types/database";
import { userHasRole } from "@/lib/auth/roles";
import { getStripeServerClient } from "@/lib/stripe/server";
import { validateBidAttachmentFile } from "@/lib/upload-validation";
import { revalidatePath } from "next/cache";
import { sendNewBidEmail } from "@/lib/email";

const PAID_SLOT_STATUSES: PaidEstimateClaimStatus[] = [
  "paid_reserved",
  "payout_pending",
  "paid_out",
  "disputed",
];

async function reservePaidSlot(
  admin: ReturnType<typeof createAdminClient>,
  poolId: string
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: currentPool } = await admin
      .from("project_paid_estimate_pools")
      .select("*")
      .eq("id", poolId)
      .maybeSingle();

    const pool = (currentPool || null) as ProjectPaidEstimatePool | null;

    if (!pool || !isPaidEstimatePoolVisibleAsPaid(pool)) {
      return null;
    }

    const remainingSlots = getRemainingPaidSlots(pool);
    if (remainingSlots <= 0) {
      return null;
    }

    const nextClaimedPaidSlots = pool.claimed_paid_slots + 1;
    const nextReservedTotalAmount =
      Number(pool.reserved_total_amount) + Number(pool.reward_amount);
    const nextStatus =
      nextClaimedPaidSlots >= pool.max_paid_slots ? "full" : "active";

    const { data: updatedPool } = await admin
      .from("project_paid_estimate_pools")
      .update({
        claimed_paid_slots: nextClaimedPaidSlots,
        reserved_total_amount: nextReservedTotalAmount,
        status: nextStatus,
      })
      .eq("id", pool.id)
      .eq("claimed_paid_slots", pool.claimed_paid_slots)
      .eq("reserved_total_amount", pool.reserved_total_amount)
      .select("*")
      .maybeSingle();

    if (updatedPool) {
      return {
        pool: updatedPool as ProjectPaidEstimatePool,
        slotSequence: nextClaimedPaidSlots,
      };
    }
  }

  return null;
}

async function createPaidEstimateClaimForBid(options: {
  admin: ReturnType<typeof createAdminClient>;
  projectId: string;
  customerId: string;
  bidId: string;
  bidderId: string;
  bidderCredentials: BidderCredentials | null;
}) {
  const { admin, projectId, customerId, bidId, bidderId, bidderCredentials } =
    options;

  const { data: poolRow } = await admin
    .from("project_paid_estimate_pools")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  let pool = (poolRow || null) as ProjectPaidEstimatePool | null;

  if (
    pool &&
    !pool.funded_at &&
    (pool.stripe_checkout_session_id || pool.stripe_payment_intent_id)
  ) {
    try {
      const stripe = getStripeServerClient();
      const reconciliation = await reconcilePaidEstimatePoolFunding({
        admin,
        stripe,
        pool,
        customerId,
      });

      if (reconciliation.didMarkFunded) {
        const { data: refreshedPool } = await admin
          .from("project_paid_estimate_pools")
          .select("*")
          .eq("project_id", projectId)
          .maybeSingle();

        pool = (refreshedPool || null) as ProjectPaidEstimatePool | null;
      }
    } catch (error) {
      console.error("Paid estimate claim funding reconciliation failed:", error);
    }
  }

  if (!pool || !isPaidEstimatePoolVisibleAsPaid(pool)) {
    return { claimStatus: null as PaidEstimateClaimStatus | null };
  }

  const { data: priorClaims } = await admin
    .from("paid_estimate_claims")
    .select("claim_status")
    .eq("project_id", projectId)
    .eq("bidder_id", bidderId)
    .in("claim_status", PAID_SLOT_STATUSES);

  const alreadyClaimedPaidSlot = (priorClaims || []).length > 0;
  const eligibility = getPaidEstimateEligibility(
    bidderCredentials,
    pool.filter
  );
  const canClaimPaidSlot = eligibility.isEligible && !alreadyClaimedPaidSlot;

  if (!canClaimPaidSlot) {
    await admin.from("paid_estimate_claims").insert({
      project_id: projectId,
      bid_id: bidId,
      bidder_id: bidderId,
      pool_id: pool.id,
      claim_status: "unpaid_bid",
      was_paid_eligible: eligibility.isEligible,
    });

    return { claimStatus: "unpaid_bid" as PaidEstimateClaimStatus };
  }

  const reserved = await reservePaidSlot(admin, pool.id);

  if (!reserved) {
    await admin.from("paid_estimate_claims").insert({
      project_id: projectId,
      bid_id: bidId,
      bidder_id: bidderId,
      pool_id: pool.id,
      claim_status: "unpaid_bid",
      was_paid_eligible: eligibility.isEligible,
    });

    return { claimStatus: "unpaid_bid" as PaidEstimateClaimStatus };
  }

  const payoutDueAt = getPaidEstimatePayoutDueAt();
  const { error: claimError } = await admin.from("paid_estimate_claims").insert({
    project_id: projectId,
    bid_id: bidId,
    bidder_id: bidderId,
    pool_id: reserved.pool.id,
    claim_status: "paid_reserved",
    was_paid_eligible: true,
    slot_sequence: reserved.slotSequence,
    reward_amount: reserved.pool.reward_amount,
    contractor_payout_amount: reserved.pool.contractor_payout_amount,
    platform_fee_amount: reserved.pool.platform_fee_amount,
    reserved_at: new Date().toISOString(),
    payout_due_at: payoutDueAt,
  });

  if (claimError) {
    console.error("Paid estimate claim insert error:", claimError);

    await admin
      .from("project_paid_estimate_pools")
      .update({
        claimed_paid_slots: Math.max(0, reserved.pool.claimed_paid_slots - 1),
        reserved_total_amount: Math.max(
          0,
          Number(reserved.pool.reserved_total_amount) -
            Number(reserved.pool.reward_amount)
        ),
        status: "active",
      })
      .eq("id", reserved.pool.id);

    return { claimStatus: null as PaidEstimateClaimStatus | null };
  }

  return {
    claimStatus: "paid_reserved" as PaidEstimateClaimStatus,
    payoutDueAt,
  };
}

export async function submitBid(formData: FormData) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to submit a bid." };
  }

  if (!(await userHasRole(user.id, "bidder"))) {
    return { error: "Enable contractor mode to submit bids." };
  }

  const projectId = formData.get("projectId") as string;
  const trade = formData.get("trade") as string;
  const price = formData.get("price") as string;
  const priceBreakdown = formData.get("priceBreakdown") as string;
  const estimatedTimeline = formData.get("estimatedTimeline") as string;
  const estimatedStartDate = formData.get("estimatedStartDate") as string;
  const notes = formData.get("notes") as string;
  const scopeCoverageRaw = (formData.get("scopeCoverage") as string) || "all";
  const scopeCoverage: "all" | "part" =
    scopeCoverageRaw === "part" ? "part" : "all";
  const scopeDescriptionRaw =
    (formData.get("scopeDescription") as string) || "";
  const scopeDescription = scopeDescriptionRaw.trim();

  if (!projectId || !trade || !price || !estimatedTimeline || !estimatedStartDate) {
    return { error: "Please fill in all required fields." };
  }

  if (scopeCoverage === "part" && scopeDescription.length === 0) {
    return {
      error:
        "Please describe which part of the project your bid covers.",
    };
  }

  const parsedPrice = parseFloat(price);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return { error: "Please enter a valid bid price." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, customer_id, title, status")
    .eq("id", projectId)
    .single();

  if (!project || project.status !== "open") {
    return { error: "This project is no longer open for bidding." };
  }

  // Check if already bid on this trade for this project
  const { data: existingBid } = await supabase
    .from("bids")
    .select("id")
    .eq("project_id", projectId)
    .eq("bidder_id", user.id)
    .eq("trade", trade)
    .single();

  if (existingBid) {
    return { error: "You have already submitted a bid for this trade on this project." };
  }

  const { data: bid, error: bidError } = await supabase
    .from("bids")
    .insert({
      project_id: projectId,
      bidder_id: user.id,
      trade: trade as TradeCategory,
      price: parsedPrice,
      price_breakdown: priceBreakdown || null,
      estimated_timeline: estimatedTimeline,
      estimated_start_date: estimatedStartDate,
      notes: notes || null,
      scope_coverage: scopeCoverage,
      scope_description: scopeCoverage === "part" ? scopeDescription : null,
    })
    .select("id")
    .single();

  if (bidError) {
    console.error("Bid submission error:", bidError);
    return { error: "Failed to submit bid. Please try again." };
  }

  // Handle file uploads
  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => f.size > 0);

  for (const file of validFiles) {
    const validationError = validateBidAttachmentFile(file);
    if (validationError) {
      return { error: validationError };
    }
  }

  if (validFiles.length > 0 && bid) {
    for (const file of validFiles) {
      const fileExt = file.name.split(".").pop();
      const filePath = `bids/${bid.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("bid-files")
        .upload(filePath, file, { contentType: file.type || undefined });

      if (!uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("bid-files").getPublicUrl(filePath);

        await supabase.from("bid_files").insert({
          bid_id: bid.id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
        });
      }
    }
  }

  const { data: bidderCredentials } = await supabase
    .from("bidder_credentials")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const claimResult =
    bid &&
    (await createPaidEstimateClaimForBid({
      admin,
      projectId,
      customerId: project.customer_id,
      bidId: bid.id,
      bidderId: user.id,
      bidderCredentials,
    }));

  if (project) {
    await supabase.from("notifications").insert({
      user_id: project.customer_id,
      type: "new_bid",
      title: "New bid received!",
      message: `A contractor has submitted a bid on "${project.title}".`,
      link: `/customer/projects/${projectId}`,
    });

    const { data: customerProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", project.customer_id)
      .single();

    if (customerProfile?.email) {
      sendNewBidEmail(customerProfile.email, project.title, projectId);
    }

    if (claimResult?.claimStatus === "paid_reserved") {
      await supabase.from("notifications").insert({
        user_id: project.customer_id,
        type: "paid_estimate_slot_claimed",
        title: "A paid estimate slot was claimed",
        message: `A contractor claimed a paid estimate slot on "${project.title}".`,
        link: `/customer/projects/${projectId}`,
      });
    }
  }

  if (claimResult?.claimStatus === "paid_reserved") {
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "paid_estimate_payout_scheduled",
      title: "Paid estimate slot reserved",
      message:
        "Your estimate qualified for a paid slot. Payment is scheduled unless the customer opens a valid dispute within 48 hours.",
      link: "/bidder/bids",
    });
  }

  redirect(`/bidder/bids`);
}

export async function saveBidderProjectSearch(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };
  if (!(await userHasRole(user.id, "bidder"))) {
    return { error: "Enable contractor mode to save project searches." };
  }

  const label = ((formData.get("label") as string) || "").trim();
  const queryString = ((formData.get("queryString") as string) || "").trim();
  const notifyOnNewMatches = formData.get("notifyOnNewMatches") === "on";

  if (!label) return { error: "Please give this search a name." };

  const { error } = await supabase
    .from("bidder_saved_project_searches")
    .insert({
      user_id: user.id,
      label: label.slice(0, 80),
      query_string: queryString,
      notify_on_new_matches: notifyOnNewMatches,
    });

  if (error) {
    console.error("Save bidder project search error:", error);
    return { error: "Could not save this search right now." };
  }

  revalidatePath("/bidder/projects");
  return { success: true };
}

export async function deleteBidderProjectSearch(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };
  if (!(await userHasRole(user.id, "bidder"))) {
    return { error: "Enable contractor mode to manage saved searches." };
  }

  const searchId = (formData.get("searchId") as string) || "";
  if (!searchId) return { error: "Missing saved search id." };

  const { error } = await supabase
    .from("bidder_saved_project_searches")
    .delete()
    .eq("id", searchId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Delete bidder project search error:", error);
    return { error: "Could not delete this saved search right now." };
  }

  revalidatePath("/bidder/projects");
  return { success: true };
}

export async function checkBidderProjectAlerts() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };
  if (!(await userHasRole(user.id, "bidder"))) {
    return { error: "Enable contractor mode to check project alerts." };
  }

  const { data: savedSearches } = await supabase
    .from("bidder_saved_project_searches")
    .select("*")
    .eq("user_id", user.id)
    .eq("notify_on_new_matches", true);

  if (!savedSearches || savedSearches.length === 0) {
    revalidatePath("/bidder/projects");
    return { success: true };
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, trades, location_city, location_state, created_at")
    .eq("status", "open");

  const nowIso = new Date().toISOString();
  let createdCount = 0;

  for (const savedSearch of savedSearches) {
    const since = new Date(
      savedSearch.last_notified_at || savedSearch.created_at
    ).getTime();

    const params = new URLSearchParams(savedSearch.query_string);
    const searchTrade = (params.get("trade") || "").trim();
    const searchState = (params.get("state") || "").trim().toUpperCase();
    const searchCity = (params.get("city") || "").trim().toLowerCase();

    const newMatches = (projects || []).filter((project) => {
      const createdAt = new Date(project.created_at).getTime();
      if (createdAt <= since) return false;

      if (
        searchTrade &&
        !(project.trades as string[]).includes(searchTrade)
      ) {
        return false;
      }

      if (
        searchState &&
        project.location_state?.trim().toUpperCase() !== searchState
      ) {
        return false;
      }

      if (
        searchCity &&
        project.location_city?.trim().toLowerCase() !== searchCity
      ) {
        return false;
      }

      return true;
    });

    if (newMatches.length > 0) {
      const projectLabel =
        newMatches.length === 1 ? "1 new project" : `${newMatches.length} new projects`;

      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "project_search_alert",
        title: `New matches for "${savedSearch.label}"`,
        message: `${projectLabel} matched your saved search.`,
        link: "/bidder/projects",
      });

      createdCount += 1;
    }

    await supabase
      .from("bidder_saved_project_searches")
      .update({ last_notified_at: nowIso })
      .eq("id", savedSearch.id)
      .eq("user_id", user.id);
  }

  revalidatePath("/bidder/projects");
  revalidatePath("/bidder/notifications");
  return { success: true, createdCount };
}
