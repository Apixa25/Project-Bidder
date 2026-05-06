"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { markPaidEstimateClaimPaidOut } from "@/lib/paid-estimates/payout-processing";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Not authorized");

  return { supabase, adminUserId: user.id };
}

async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminId: string,
  actionType: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {}
) {
  await supabase.from("admin_audit_logs").insert({
    admin_id: adminId,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    details,
  });
}

export async function banUser(userId: string, reason: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("user_id", userId)
    .single();

  if (target?.role === "admin") return { error: "Cannot ban an admin" };

  await supabase
    .from("profiles")
    .update({
      is_banned: true,
      banned_at: new Date().toISOString(),
      banned_by: adminUserId,
      ban_reason: reason,
    })
    .eq("user_id", userId);

  await logAudit(supabase, adminUserId, "ban_user", "user", userId, {
    reason,
    user_name: target?.full_name,
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}

export async function unbanUser(userId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .single();

  await supabase
    .from("profiles")
    .update({
      is_banned: false,
      banned_at: null,
      banned_by: null,
      ban_reason: null,
    })
    .eq("user_id", userId);

  await logAudit(supabase, adminUserId, "unban_user", "user", userId, {
    user_name: target?.full_name,
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}

export async function deleteUser(userId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("full_name, role, email")
    .eq("user_id", userId)
    .single();

  if (target?.role === "admin") return { error: "Cannot delete an admin" };

  await logAudit(supabase, adminUserId, "delete_user", "user", userId, {
    user_name: target?.full_name,
    user_email: target?.email,
    user_role: target?.role,
  });

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { success: true };
}

// Triggers a standard Supabase password-reset email for any user account.
// The link in the email lands at /auth/callback?next=/reset-password — the
// same flow the user-facing "Forgot password?" link uses. Admins should
// use this when a user is locked out and can't receive the self-serve
// reset (e.g., they signed up with a typo in their email and need a manual
// hand-off, or they're reporting access issues via support).
//
// IMPORTANT: The reset email goes to the USER's address, not the admin.
// No admin can hijack the account through this action — Supabase only
// sends the link to the registered email.
export async function adminSendPasswordReset(
  userId: string,
  userEmail: string
) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("user_id", userId)
    .single();

  if (target?.role === "admin") {
    return { error: "Cannot send a password reset for an admin account." };
  }

  // Derive the canonical site URL from the environment variable. We avoid
  // reading request headers here because this action can be triggered from
  // a fetch rather than a page navigation, and the origin header isn't
  // reliable in that context.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://projectxbidx.com";

  const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
    redirectTo: `${baseUrl}/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error("Admin-triggered password reset error:", error);
    return {
      error: "Failed to send the password reset email. Please try again.",
    };
  }

  await logAudit(
    supabase,
    adminUserId,
    "admin_password_reset",
    "user",
    userId,
    {
      target_email: userEmail,
      target_name: target?.full_name,
    }
  );

  return { success: true };
}

export async function enableEstimatorRole(userId: string) {
  const { supabase, adminUserId } = await requireAdmin();
  const adminClient = createAdminClient();

  const { data: target, error: targetError } = await adminClient
    .from("profiles")
    .select("full_name, business_name, email")
    .eq("user_id", userId)
    .single();

  if (targetError || !target) {
    return { error: "User profile could not be found." };
  }

  const { error: roleError } = await adminClient.from("user_roles").upsert(
    {
      user_id: userId,
      role: "estimator",
    },
    { onConflict: "user_id,role", ignoreDuplicates: true }
  );

  if (roleError) {
    console.error("Enable estimator role error:", roleError);
    return { error: "Unable to enable estimator mode for this user." };
  }

  const displayName =
    target.business_name?.trim() || target.full_name?.trim() || target.email;

  const { error: profileError } = await adminClient
    .from("estimator_profiles")
    .upsert(
      {
        user_id: userId,
        display_name: displayName,
      },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

  if (profileError) {
    console.error("Estimator profile bootstrap error:", profileError);
    return {
      error:
        "Estimator mode was enabled, but estimator profile setup failed.",
    };
  }

  await logAudit(supabase, adminUserId, "enable_estimator_role", "user", userId, {
    user_name: target.full_name,
    user_email: target.email,
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/estimate-packages");

  return { success: true };
}

export async function deleteProject(projectId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: project } = await supabase
    .from("projects")
    .select("title, customer_id")
    .eq("id", projectId)
    .single();

  await logAudit(supabase, adminUserId, "delete_project", "project", projectId, {
    project_title: project?.title,
  });

  await supabase.from("projects").delete().eq("id", projectId);

  revalidatePath("/admin/projects");
  revalidatePath("/admin");
  return { success: true };
}

export async function forceCloseProject(projectId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .single();

  await supabase
    .from("projects")
    .update({ status: "closed" })
    .eq("id", projectId);

  await logAudit(supabase, adminUserId, "force_close_project", "project", projectId, {
    project_title: project?.title,
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
  return { success: true };
}

export async function deleteBid(bidId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: bid } = await supabase
    .from("bids")
    .select("project_id, bidder_id, price")
    .eq("id", bidId)
    .single();

  await logAudit(supabase, adminUserId, "delete_bid", "bid", bidId, {
    project_id: bid?.project_id,
    bidder_id: bid?.bidder_id,
  });

  await supabase.from("bids").delete().eq("id", bidId);

  revalidatePath("/admin/bids");
  if (bid?.project_id) revalidatePath(`/admin/projects/${bid.project_id}`);
  return { success: true };
}

export async function deleteMessage(messageId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  await logAudit(supabase, adminUserId, "delete_message", "message", messageId, {});

  await supabase.from("messages").delete().eq("id", messageId);

  revalidatePath("/admin/messages");
  return { success: true };
}

export async function hideReview(reviewId: string, flagId?: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: review } = await supabase
    .from("user_reviews")
    .select("reviewee_user_id, review_title, status")
    .eq("id", reviewId)
    .single();

  await supabase
    .from("user_reviews")
    .update({ status: "hidden" })
    .eq("id", reviewId);

  if (flagId) {
    await supabase
      .from("flagged_content")
      .update({ resolved: true })
      .eq("id", flagId);
  }

  await logAudit(supabase, adminUserId, "hide_review", "review", reviewId, {
    flag_id: flagId,
    previous_status: review?.status,
    review_title: review?.review_title,
  });

  revalidatePath("/admin/flags");
  if (review?.reviewee_user_id) {
    revalidatePath(`/profile/${review.reviewee_user_id}`);
  }
  return { success: true };
}

export async function publishReview(reviewId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: review } = await supabase
    .from("user_reviews")
    .select("reviewee_user_id, review_title, status")
    .eq("id", reviewId)
    .single();

  await supabase
    .from("user_reviews")
    .update({ status: "published" })
    .eq("id", reviewId);

  await logAudit(supabase, adminUserId, "publish_review", "review", reviewId, {
    previous_status: review?.status,
    review_title: review?.review_title,
  });

  revalidatePath("/admin/flags");
  if (review?.reviewee_user_id) {
    revalidatePath(`/profile/${review.reviewee_user_id}`);
  }
  return { success: true };
}

export async function deleteReview(reviewId: string, flagId?: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: review } = await supabase
    .from("user_reviews")
    .select("reviewee_user_id, reviewer_user_id, review_title, review_body")
    .eq("id", reviewId)
    .single();

  await supabase.from("user_reviews").delete().eq("id", reviewId);

  if (flagId) {
    await supabase
      .from("flagged_content")
      .update({ resolved: true })
      .eq("id", flagId);
  }

  await logAudit(supabase, adminUserId, "delete_review", "review", reviewId, {
    flag_id: flagId,
    reviewee_user_id: review?.reviewee_user_id,
    reviewer_user_id: review?.reviewer_user_id,
    review_title: review?.review_title,
  });

  revalidatePath("/admin/flags");
  if (review?.reviewee_user_id) {
    revalidatePath(`/profile/${review.reviewee_user_id}`);
  }
  return { success: true };
}

export async function resolveFlag(flagId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  await supabase
    .from("flagged_content")
    .update({ resolved: true })
    .eq("id", flagId);

  await logAudit(supabase, adminUserId, "resolve_flag", "flag", flagId, {});

  revalidatePath("/admin/flags");
  revalidatePath("/admin");
  return { success: true };
}

export async function dismissFlag(flagId: string, note: string) {
  const { supabase, adminUserId } = await requireAdmin();

  await supabase
    .from("flagged_content")
    .update({ resolved: true })
    .eq("id", flagId);

  await logAudit(supabase, adminUserId, "dismiss_flag", "flag", flagId, { note });

  revalidatePath("/admin/flags");
  revalidatePath("/admin");
  return { success: true };
}

export async function resolvePaidEstimateDispute(
  disputeId: string,
  decision: "pay" | "deny",
  reviewNotes: string
) {
  const { supabase, adminUserId } = await requireAdmin();
  const admin = createAdminClient();

  const { data: dispute } = await admin
    .from("paid_estimate_disputes")
    .select("*")
    .eq("id", disputeId)
    .single();

  if (!dispute) {
    return { error: "Dispute not found." };
  }

  if (dispute.review_status !== "open") {
    return { error: "This dispute has already been resolved." };
  }

  const { data: claim } = await admin
    .from("paid_estimate_claims")
    .select("*")
    .eq("id", dispute.claim_id)
    .single();

  if (!claim) {
    return { error: "Claim not found for this dispute." };
  }

  const nowIso = new Date().toISOString();
  const nextReviewStatus =
    decision === "pay" ? "resolved_paid" : "resolved_denied";
  const nextClaimStatus =
    decision === "pay" ? "payout_pending" : "payout_denied_refunded";

  const { error: disputeUpdateError } = await admin
    .from("paid_estimate_disputes")
    .update({
      review_status: nextReviewStatus,
      review_notes: reviewNotes || null,
      resolved_by: adminUserId,
      resolved_at: nowIso,
    })
    .eq("id", disputeId);

  if (disputeUpdateError) {
    return { error: "Failed to update dispute status." };
  }

  const claimUpdate: Record<string, unknown> = {
    claim_status: nextClaimStatus,
  };

  if (decision === "deny") {
    claimUpdate.denied_refunded_at = nowIso;
  }

  const { error: claimUpdateError } = await admin
    .from("paid_estimate_claims")
    .update(claimUpdate)
    .eq("id", claim.id);

  if (claimUpdateError) {
    return { error: "Failed to update the paid estimate claim." };
  }

  if (decision === "deny" && claim.pool_id && claim.reward_amount) {
    const { data: pool } = await admin
      .from("project_paid_estimate_pools")
      .select("id, reserved_total_amount, refunded_total_amount")
      .eq("id", claim.pool_id)
      .single();

    if (pool) {
      await admin
        .from("project_paid_estimate_pools")
        .update({
          reserved_total_amount: Math.max(
            0,
            Number(pool.reserved_total_amount) - Number(claim.reward_amount)
          ),
          refunded_total_amount:
            Number(pool.refunded_total_amount) + Number(claim.reward_amount),
        })
        .eq("id", pool.id);
    }
  }

  const notificationMessage =
    decision === "pay"
      ? "Your paid estimate dispute was reviewed and the estimate remains payable."
      : "Your paid estimate dispute was reviewed and the estimate payout was denied.";

  await supabase.from("notifications").insert({
    user_id: dispute.bidder_id,
    type: "paid_estimate_dispute_resolved",
    title: "Paid estimate dispute resolved",
    message: notificationMessage,
    link: `/bidder/bids`,
  });

  await logAudit(
    supabase,
    adminUserId,
    "resolve_paid_estimate_dispute",
    "paid_estimate_dispute",
    disputeId,
    {
      decision,
      claim_id: dispute.claim_id,
      project_id: dispute.project_id,
      review_notes: reviewNotes || null,
    }
  );

  revalidatePath("/admin/disputes");
  revalidatePath("/admin/paid-estimates");
  revalidatePath(`/admin/projects/${dispute.project_id}`);
  revalidatePath(`/customer/projects/${dispute.project_id}`);
  revalidatePath("/bidder/bids");
  return { success: true };
}

export async function markPaidEstimateClaimPaidOutManually(
  claimId: string,
  note: string
) {
  const { supabase, adminUserId } = await requireAdmin();
  const admin = createAdminClient();

  const { data: claim } = await admin
    .from("paid_estimate_claims")
    .select("*")
    .eq("id", claimId)
    .single();

  if (!claim) {
    return { error: "Claim not found." };
  }

  if (claim.claim_status !== "payout_pending") {
    return {
      error: "Only payout-pending paid estimate claims can be marked as paid out.",
    };
  }

  const payoutResult = await markPaidEstimateClaimPaidOut({
    admin,
    claim,
  });

  if ("error" in payoutResult) {
    return { error: payoutResult.error };
  }

  const { data: project } = await admin
    .from("projects")
    .select("customer_id, title")
    .eq("id", claim.project_id)
    .maybeSingle();

  const notifications = [
    {
      user_id: claim.bidder_id,
      type: "paid_estimate_paid_out",
      title: "Paid estimate paid out",
      message:
        "Your paid estimate was manually marked as paid out by the platform team.",
      link: "/bidder/payouts",
    },
  ];

  if (project?.customer_id) {
    notifications.push({
      user_id: project.customer_id,
      type: "paid_estimate_paid_out",
      title: "Paid estimate paid out",
      message: `A paid estimate on "${project.title}" was manually marked as paid out.`,
      link: `/customer/projects/${claim.project_id}`,
    });
  }

  await supabase.from("notifications").insert(notifications);

  await logAudit(
    supabase,
    adminUserId,
    "manual_paid_estimate_paid_out",
    "paid_estimate_claim",
    claimId,
    {
      project_id: claim.project_id,
      bid_id: claim.bid_id,
      bidder_id: claim.bidder_id,
      note: note || null,
    }
  );

  revalidatePath("/admin/paid-estimates");
  revalidatePath(`/admin/projects/${claim.project_id}`);
  revalidatePath(`/customer/projects/${claim.project_id}`);
  revalidatePath("/bidder/bids");
  revalidatePath("/bidder/payouts");
  return { success: true };
}
