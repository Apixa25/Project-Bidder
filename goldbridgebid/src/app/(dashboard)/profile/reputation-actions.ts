"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendNewReviewEmail } from "@/lib/email";

// Best-effort: drop a notification on the reviewee + fire an email letting
// them know they've received a review. Failures here are logged but never
// block the underlying review insert (the review is the source of truth;
// the notification is just a delivery channel).
async function notifyRevieweeOfNewReview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    revieweeUserId: string;
    reviewerUserId: string;
    ratingOverall: number;
    reviewType: "verified_platform" | "public_reference";
  }
) {
  try {
    const reviewLabel =
      params.reviewType === "verified_platform"
        ? "verified project review"
        : "community review";

    const { data: reviewerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", params.reviewerUserId)
      .maybeSingle();

    const reviewerName = reviewerProfile?.full_name || "A community member";

    await supabase.from("notifications").insert({
      user_id: params.revieweeUserId,
      type: "new_review",
      title: `New ${params.ratingOverall}-star review`,
      message: `${reviewerName} just left a ${reviewLabel} on your profile.`,
      link: `/profile/${params.revieweeUserId}`,
    });

    const { data: revieweeProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", params.revieweeUserId)
      .maybeSingle();

    if (revieweeProfile?.email) {
      await sendNewReviewEmail(
        revieweeProfile.email,
        reviewerName,
        params.ratingOverall,
        params.reviewType,
        params.revieweeUserId
      );
    }
  } catch (notifyError) {
    console.error("notifyRevieweeOfNewReview failed:", notifyError);
  }
}

function normalizeRating(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

async function uploadReviewPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reviewId: string,
  formData: FormData
) {
  const photos = formData.getAll("reviewPhotos") as File[];
  const validPhotos = photos.filter(
    (f) => f instanceof File && f.size > 0 && f.type.startsWith("image/")
  );

  for (const [index, photo] of validPhotos.entries()) {
    if (index >= 5) break;

    const fileExt = photo.name.split(".").pop() || "jpg";
    const filePath = `reviews/${reviewId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(filePath, photo, { contentType: photo.type });

    if (uploadError) {
      console.error("Review photo upload error:", uploadError);
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("project-files").getPublicUrl(filePath);

    await supabase.from("review_photos").insert({
      review_id: reviewId,
      file_url: publicUrl,
      file_name: photo.name,
      display_order: index,
    });
  }
}

export async function giveHeart(targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to give a heart." };
  }

  if (user.id === targetUserId) {
    return { error: "You cannot heart your own profile." };
  }

  const { error } = await supabase.from("profile_hearts").insert({
    giver_user_id: user.id,
    target_user_id: targetUserId,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already gave this user a heart." };
    }

    console.error("Give heart error:", error);
    return { error: "Unable to save your heart right now." };
  }

  revalidatePath(`/profile/${targetUserId}`);
  return { success: true };
}

export async function createPublicReview(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to leave a public reference." };
  }

  const revieweeUserId = String(formData.get("revieweeUserId") || "");
  const ratingOverall = normalizeRating(formData.get("ratingOverall"));
  const reviewBody = String(formData.get("reviewBody") || "").trim();
  const reviewTitle = normalizeOptionalText(formData.get("reviewTitle"));
  const relationshipContext = normalizeOptionalText(formData.get("relationshipContext"));

  if (!revieweeUserId || user.id === revieweeUserId) {
    return { error: "You cannot review your own profile." };
  }

  if (!ratingOverall) {
    return { error: "Please choose an overall rating from 1 to 5." };
  }

  // Body is optional — stars-only reviews are explicitly supported. The DB
  // column is NOT NULL so we still store an empty string rather than null.
  const { data: review, error } = await supabase
    .from("user_reviews")
    .insert({
      review_type: "public_reference",
      reviewer_user_id: user.id,
      reviewee_user_id: revieweeUserId,
      rating_overall: ratingOverall,
      review_title: reviewTitle,
      review_body: reviewBody,
      relationship_context: relationshipContext,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "You already left a public reference for this user." };
    }

    console.error("Create public review error:", error);
    return { error: "Unable to save your public reference right now." };
  }

  if (review) {
    await uploadReviewPhotos(supabase, review.id, formData);
    await notifyRevieweeOfNewReview(supabase, {
      revieweeUserId,
      reviewerUserId: user.id,
      ratingOverall,
      reviewType: "public_reference",
    });
  }

  revalidatePath(`/profile/${revieweeUserId}`);
  return { success: true };
}

export async function createVerifiedReview(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to leave a verified review." };
  }

  const revieweeUserId = String(formData.get("revieweeUserId") || "");
  const projectId = String(formData.get("projectId") || "");
  const ratingOverall = normalizeRating(formData.get("ratingOverall"));
  const ratingCommunication = normalizeRating(formData.get("ratingCommunication"));
  const ratingQuality = normalizeRating(formData.get("ratingQuality"));
  const ratingReliability = normalizeRating(formData.get("ratingReliability"));
  const reviewBody = String(formData.get("reviewBody") || "").trim();
  const reviewTitle = normalizeOptionalText(formData.get("reviewTitle"));
  const wouldWorkAgainRaw = String(formData.get("wouldWorkAgain") || "");
  const wouldWorkAgain =
    wouldWorkAgainRaw === "yes" ? true : wouldWorkAgainRaw === "no" ? false : null;

  if (!revieweeUserId || !projectId || user.id === revieweeUserId) {
    return { error: "This verified review is not valid." };
  }

  if (!ratingOverall || !ratingCommunication || !ratingQuality || !ratingReliability) {
    return { error: "Please complete all verified review ratings." };
  }

  // Body is optional on verified reviews too. Star ratings carry the signal
  // even when the reviewer doesn't have time to write a paragraph.

  const { data: project } = await supabase
    .from("projects")
    .select("id, customer_id, awarded_bidder_id, status")
    .eq("id", projectId)
    .in("status", ["awarded", "completed"])
    .single();

  if (!project || !project.awarded_bidder_id) {
    return { error: "This project is not eligible for a verified review." };
  }

  const reviewerIsCustomer = project.customer_id === user.id;
  const reviewerIsAwardedBidder = project.awarded_bidder_id === user.id;

  if (!reviewerIsCustomer && !reviewerIsAwardedBidder) {
    return { error: "You are not eligible to leave a verified review for this project." };
  }

  const expectedRevieweeUserId = reviewerIsCustomer
    ? project.awarded_bidder_id
    : project.customer_id;

  if (revieweeUserId !== expectedRevieweeUserId) {
    return { error: "This verified review target does not match the awarded project." };
  }

  const { data: review, error } = await supabase
    .from("user_reviews")
    .insert({
      review_type: "verified_platform",
      reviewer_user_id: user.id,
      reviewee_user_id: revieweeUserId,
      project_id: projectId,
      rating_overall: ratingOverall,
      rating_communication: ratingCommunication,
      rating_quality: ratingQuality,
      rating_reliability: ratingReliability,
      review_title: reviewTitle,
      review_body: reviewBody,
      would_work_again: wouldWorkAgain,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "You already left a verified review for this project." };
    }

    console.error("Create verified review error:", error);
    return { error: "Unable to save your verified review right now." };
  }

  if (review) {
    await uploadReviewPhotos(supabase, review.id, formData);
    await notifyRevieweeOfNewReview(supabase, {
      revieweeUserId,
      reviewerUserId: user.id,
      ratingOverall,
      reviewType: "verified_platform",
    });
  }

  revalidatePath(`/profile/${revieweeUserId}`);
  return { success: true };
}

// Insert OR update the reviewee's response on a review. Only the user being
// reviewed (i.e. user_reviews.reviewee_user_id === auth.uid()) can call this
// successfully — RLS enforces that, but we also do a defensive check first
// for a clearer error message. Body is required and trimmed.
export async function respondToReview(reviewId: string, body: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to respond to a review." };
  }

  const trimmedBody = body.trim();
  if (trimmedBody.length === 0) {
    return { error: "Please write something before posting your response." };
  }

  const { data: review } = await supabase
    .from("user_reviews")
    .select("id, reviewer_user_id, reviewee_user_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review) {
    return { error: "Review not found." };
  }

  if (review.reviewee_user_id !== user.id) {
    return {
      error: "Only the user who was reviewed can respond to this review.",
    };
  }

  // Upsert pattern: try insert first; if there's already a response (UNIQUE
  // on review_id), fall back to update. This way the same action handles
  // both first-time response and subsequent edits.
  const { error: insertError } = await supabase
    .from("review_responses")
    .insert({
      review_id: reviewId,
      responder_user_id: user.id,
      body: trimmedBody,
    });

  if (insertError && insertError.code === "23505") {
    const { error: updateError } = await supabase
      .from("review_responses")
      .update({ body: trimmedBody })
      .eq("review_id", reviewId)
      .eq("responder_user_id", user.id);

    if (updateError) {
      console.error("Update review response error:", updateError);
      return { error: "Unable to update your response right now." };
    }
  } else if (insertError) {
    console.error("Insert review response error:", insertError);
    return { error: "Unable to save your response right now." };
  } else {
    // Only fire the notification on the FIRST response (insert succeeded).
    // Editing your own response is silent — we don't want to spam the
    // reviewer every time the reviewee tweaks a typo.
    try {
      const { data: responderProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const responderName =
        responderProfile?.full_name || "The reviewed user";

      await supabase.from("notifications").insert({
        user_id: review.reviewer_user_id,
        type: "review_responded",
        title: "Your review received a response",
        message: `${responderName} responded to a review you wrote.`,
        link: `/profile/${review.reviewee_user_id}`,
      });
    } catch (notifyError) {
      console.error(
        "respondToReview notification insert failed:",
        notifyError
      );
    }
  }

  revalidatePath(`/profile/${review.reviewee_user_id}`);
  return { success: true };
}

export async function deleteReviewResponse(reviewId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const { data: review } = await supabase
    .from("user_reviews")
    .select("id, reviewee_user_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review) {
    return { error: "Review not found." };
  }

  const { error } = await supabase
    .from("review_responses")
    .delete()
    .eq("review_id", reviewId)
    .eq("responder_user_id", user.id);

  if (error) {
    console.error("Delete review response error:", error);
    return { error: "Unable to delete your response right now." };
  }

  revalidatePath(`/profile/${review.reviewee_user_id}`);
  return { success: true };
}

export async function reportReview(reviewId: string, reason: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to report a review." };
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 10) {
    return { error: "Please provide at least 10 characters explaining the report." };
  }

  const { data: review } = await supabase
    .from("user_reviews")
    .select("id, reviewer_user_id, reviewee_user_id")
    .eq("id", reviewId)
    .single();

  if (!review) {
    return { error: "Review not found." };
  }

  if (review.reviewer_user_id === user.id) {
    return { error: "You cannot report your own review." };
  }

  const { error } = await supabase.from("flagged_content").insert({
    reporter_id: user.id,
    content_type: "review",
    content_id: reviewId,
    reason: trimmedReason,
  });

  if (error) {
    console.error("Report review error:", error);
    return { error: "Unable to submit that report right now." };
  }

  revalidatePath(`/profile/${review.reviewee_user_id}`);
  return { success: true };
}
