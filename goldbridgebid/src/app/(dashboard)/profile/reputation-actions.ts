"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function normalizeRating(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
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

  if (reviewBody.length < 20) {
    return { error: "Please write at least 20 characters for the review." };
  }

  const { error } = await supabase.from("user_reviews").insert({
    review_type: "public_reference",
    reviewer_user_id: user.id,
    reviewee_user_id: revieweeUserId,
    rating_overall: ratingOverall,
    review_title: reviewTitle,
    review_body: reviewBody,
    relationship_context: relationshipContext,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already left a public reference for this user." };
    }

    console.error("Create public review error:", error);
    return { error: "Unable to save your public reference right now." };
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

  if (reviewBody.length < 20) {
    return { error: "Please write at least 20 characters for the review." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, customer_id, awarded_bidder_id, status")
    .eq("id", projectId)
    .eq("status", "awarded")
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

  const { error } = await supabase.from("user_reviews").insert({
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
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already left a verified review for this project." };
    }

    console.error("Create verified review error:", error);
    return { error: "Unable to save your verified review right now." };
  }

  revalidatePath(`/profile/${revieweeUserId}`);
  return { success: true };
}
