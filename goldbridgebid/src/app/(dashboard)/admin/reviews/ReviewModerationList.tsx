"use client";

import Link from "next/link";
import { hideReview, publishReview, deleteReview } from "@/app/(dashboard)/admin/actions";
import { deleteReviewResponse } from "@/app/(dashboard)/profile/reputation-actions";

interface ReviewItem {
  id: string;
  review_type: "verified_platform" | "public_reference";
  status: "published" | "flagged" | "hidden";
  rating_overall: number;
  review_title: string | null;
  review_body: string;
  relationship_context: string | null;
  created_at: string;
  project_id: string | null;
  reviewerName: string;
  reviewerUserId: string;
  revieweeName: string;
  revieweeUserId: string;
  reportCount: number;
  response: {
    body: string;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export default function ReviewModerationList({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-12 text-center shadow-sm">
        <p className="text-sm text-text-muted">No reviews match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <article
          key={review.id}
          className="rounded-xl border border-border bg-surface p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    review.review_type === "verified_platform"
                      ? "bg-secondary/15 text-secondary"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {review.review_type === "verified_platform"
                    ? "Verified Project Review"
                    : "Public Reference"}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    review.status === "published"
                      ? "bg-green-100 text-green-700"
                      : review.status === "hidden"
                        ? "bg-gray-200 text-gray-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {review.status}
                </span>
                <span className="text-sm font-semibold text-text-primary">
                  {review.rating_overall}/5
                </span>
                {review.reportCount > 0 && (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                    {review.reportCount} report{review.reportCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <h2 className="mt-3 text-base font-semibold text-text-primary">
                {review.review_title || "Untitled review"}
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                {review.review_body}
              </p>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-muted">
                <Link
                  href={`/profile/${review.reviewerUserId}`}
                  className="text-primary hover:underline"
                >
                  Reviewer: {review.reviewerName}
                </Link>
                <Link
                  href={`/profile/${review.revieweeUserId}`}
                  className="text-primary hover:underline"
                >
                  Reviewee: {review.revieweeName}
                </Link>
                <span>{new Date(review.created_at).toLocaleString()}</span>
                {review.project_id && (
                  <Link
                    href={`/admin/projects/${review.project_id}`}
                    className="text-primary hover:underline"
                  >
                    Project-linked
                  </Link>
                )}
                {review.relationship_context && <span>{review.relationship_context}</span>}
              </div>

              {review.response && (
                <div className="mt-3 rounded-lg border border-secondary/30 bg-teal-50/60 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                      Reviewee response
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
                      <span>
                        Posted {new Date(review.response.createdAt).toLocaleString()}
                      </span>
                      {review.response.updatedAt !== review.response.createdAt && (
                        <span>
                          • Edited {new Date(review.response.updatedAt).toLocaleString()}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmed = window.confirm(
                            "Delete this reviewee response? This cannot be undone."
                          );
                          if (!confirmed) return;
                          await deleteReviewResponse(review.id);
                          window.location.reload();
                        }}
                        className="font-semibold text-red-600 hover:underline"
                      >
                        Delete response
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                    {review.response.body}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 lg:w-44 lg:flex-col">
              {review.status !== "published" && (
                <button
                  type="button"
                  onClick={async () => {
                    await publishReview(review.id);
                    window.location.reload();
                  }}
                  className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-700"
                >
                  Publish
                </button>
              )}
              {review.status !== "hidden" && (
                <button
                  type="button"
                  onClick={async () => {
                    await hideReview(review.id);
                    window.location.reload();
                  }}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
                >
                  Hide
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  const confirmed = window.confirm(
                    "Delete this review permanently? This cannot be undone."
                  );
                  if (!confirmed) return;
                  await deleteReview(review.id);
                  window.location.reload();
                }}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
