"use client";

import { useState } from "react";
import { createPublicReview } from "@/app/(dashboard)/profile/reputation-actions";

interface PublicReviewFormProps {
  revieweeUserId: string;
  disabled?: boolean;
}

export default function PublicReviewForm({
  revieweeUserId,
  disabled = false,
}: PublicReviewFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const result = await createPublicReview(formData);

    if (result?.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setSuccess("Public reference posted.");
    setSaving(false);
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="revieweeUserId" value={revieweeUserId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-text-primary">
            Overall rating
          </label>
          <select
            name="ratingOverall"
            required
            disabled={disabled || saving}
            className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
            defaultValue="5"
          >
            <option value="5">5 - Excellent</option>
            <option value="4">4 - Good</option>
            <option value="3">3 - Solid</option>
            <option value="2">2 - Weak</option>
            <option value="1">1 - Poor</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-text-primary">
            Relationship
          </label>
          <select
            name="relationshipContext"
            disabled={disabled || saving}
            className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
            defaultValue="Past client"
          >
            <option value="Past client">Past client</option>
            <option value="Past contractor">Past contractor</option>
            <option value="Colleague">Colleague</option>
            <option value="Supplier">Supplier</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-text-primary">
          Review title
        </label>
        <input
          type="text"
          name="reviewTitle"
          disabled={disabled || saving}
          placeholder="Short headline"
          className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-text-primary">
          Public reference
        </label>
        <textarea
          name="reviewBody"
          required
          minLength={20}
          rows={4}
          disabled={disabled || saving}
          placeholder="Share how you know this person and what stood out about working with them."
          className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <button
        type="submit"
        disabled={disabled || saving}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Posting..." : "Post Public Reference"}
      </button>
    </form>
  );
}
