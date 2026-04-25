"use client";

import { useState } from "react";
import {
  respondToReview,
  deleteReviewResponse,
} from "@/app/(dashboard)/profile/reputation-actions";

interface ReviewResponseFormProps {
  reviewId: string;
  existingResponse: string | null;
}

// Inline form that lets the user being reviewed (the "reviewee") write,
// edit, or delete their single public response to a review. Renders in three
// modes:
//   1. No existing response, not editing  -> "Respond" button.
//   2. No existing response, editing      -> textarea + Post / Cancel.
//   3. Existing response                  -> renders the response (read-only)
//      with Edit / Delete affordances; toggling Edit reveals the textarea.
export default function ReviewResponseForm({
  reviewId,
  existingResponse,
}: ReviewResponseFormProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(existingResponse || "");
  const [savedResponse, setSavedResponse] = useState<string | null>(
    existingResponse
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!draft.trim()) {
      setError("Please write something before posting your response.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const result = await respondToReview(reviewId, draft);

    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setSavedResponse(draft);
    setEditing(false);
    setSubmitting(false);
  }

  async function handleDelete() {
    if (!confirm("Delete your response? This cannot be undone.")) return;
    setSubmitting(true);
    setError(null);

    const result = await deleteReviewResponse(reviewId);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setSavedResponse(null);
    setDraft("");
    setEditing(false);
    setSubmitting(false);
  }

  if (savedResponse && !editing) {
    return (
      <div className="mt-3 rounded-lg border border-secondary/30 bg-teal-50/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Your response
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setDraft(savedResponse);
              }}
              className="text-xs font-medium text-secondary hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              {submitting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
          {savedResponse}
        </p>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-secondary/40 bg-white px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:bg-teal-50"
        >
          Respond to this review
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-secondary/30 bg-white px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">
        Your response
      </p>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        disabled={submitting}
        placeholder="Thanks for the review! Here's a bit more context from my side…"
        className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
      />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-secondary-dark disabled:opacity-60"
        >
          {submitting
            ? "Posting..."
            : savedResponse
              ? "Update Response"
              : "Post Response"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setDraft(savedResponse || "");
            setError(null);
          }}
          disabled={submitting}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-warm disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
