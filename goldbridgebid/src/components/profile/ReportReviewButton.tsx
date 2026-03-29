"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { reportReview } from "@/app/(dashboard)/profile/reputation-actions";

interface ReportReviewButtonProps {
  reviewId: string;
}

export default function ReportReviewButton({ reviewId }: ReportReviewButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleReport() {
    const reason = window.prompt(
      "Why are you reporting this review? Please give a short explanation."
    );

    if (!reason) return;

    setSubmitting(true);
    setMessage(null);

    const result = await reportReview(reviewId, reason);
    setSubmitting(false);

    if (result?.error) {
      setMessage(result.error);
      return;
    }

    setMessage("Review reported.");
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <button
        type="button"
        onClick={handleReport}
        disabled={submitting}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Flag className="h-3.5 w-3.5" />
        {submitting ? "Reporting..." : "Report"}
      </button>
      {message && <span className="text-[11px] text-text-muted">{message}</span>}
    </div>
  );
}
