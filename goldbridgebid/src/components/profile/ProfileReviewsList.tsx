import Image from "next/image";
import ReportReviewButton from "@/components/profile/ReportReviewButton";
import ReviewResponseForm from "@/components/profile/ReviewResponseForm";

type ReviewPhoto = {
  review_id: string;
  file_url: string;
  file_name: string;
  display_order: number;
};

type ReviewResponse = {
  body: string;
  created_at: string;
  updated_at: string;
};

type ReviewListItem = {
  id: string;
  review_type: "verified_platform" | "public_reference";
  review_title: string | null;
  review_body: string;
  rating_overall: number;
  relationship_context: string | null;
  would_work_again: boolean | null;
  created_at: string;
  reviewer: {
    full_name: string;
    role: string;
  } | null;
  photos?: ReviewPhoto[];
  response?: ReviewResponse | null;
};

interface ProfileReviewsListProps {
  reviews: ReviewListItem[];
  canReport?: boolean;
  // True when the viewer IS the user being reviewed on this profile. We only
  // render the response form when this is true. The response form itself
  // double-checks via RLS; this flag just keeps the UI honest.
  viewerCanRespondAsReviewee?: boolean;
}

export default function ProfileReviewsList({
  reviews,
  canReport = false,
  viewerCanRespondAsReviewee = false,
}: ProfileReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-bg-warm px-5 py-8 text-center">
        <p className="text-sm font-medium text-text-secondary">No reviews yet.</p>
        <p className="mt-1 text-xs text-text-muted">
          Hearts and reviews will show up here as people build trust with this user.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <article
          key={review.id}
          className="rounded-xl border border-border bg-bg-warm px-5 py-4"
        >
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
                : "Community Review"}
            </span>
            <span className="text-sm font-semibold text-text-primary">
              {review.rating_overall}/5
            </span>
            <span className="text-xs text-text-muted">
              {new Date(review.created_at).toLocaleDateString()}
            </span>
            {canReport && <ReportReviewButton reviewId={review.id} />}
          </div>

          {review.review_title && (
            <h3 className="mt-3 text-base font-semibold text-text-primary">
              {review.review_title}
            </h3>
          )}

          {review.review_body.trim() && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
              {review.review_body}
            </p>
          )}

          {review.photos && review.photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {review.photos.map((photo) => (
                <a
                  key={photo.file_url}
                  href={photo.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition-shadow hover:shadow-md"
                >
                  <Image
                    src={photo.file_url}
                    alt={photo.file_name}
                    fill
                    sizes="80px"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                </a>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-muted">
            <span>
              By {review.reviewer?.full_name || "Community member"}
              {review.reviewer?.role ? ` • ${review.reviewer.role}` : ""}
            </span>
            {review.relationship_context && <span>{review.relationship_context}</span>}
            {review.would_work_again !== null && (
              <span>{review.would_work_again ? "Would work again" : "Would not work again"}</span>
            )}
          </div>

          {/* Public read-only response visible to everyone when present and
              the viewer is not the reviewee (the reviewee gets the editable
              form below instead). */}
          {review.response && !viewerCanRespondAsReviewee && (
            <div className="mt-3 rounded-lg border border-secondary/30 bg-teal-50/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                Response from this user
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                {review.response.body}
              </p>
            </div>
          )}

          {viewerCanRespondAsReviewee && (
            <ReviewResponseForm
              reviewId={review.id}
              existingResponse={review.response?.body || null}
            />
          )}
        </article>
      ))}
    </div>
  );
}
