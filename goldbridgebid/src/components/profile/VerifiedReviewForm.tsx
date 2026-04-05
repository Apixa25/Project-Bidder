"use client";

import { useState } from "react";
import { createVerifiedReview } from "@/app/(dashboard)/profile/reputation-actions";

interface EligibleProject {
  id: string;
  title: string;
}

interface VerifiedReviewFormProps {
  revieweeUserId: string;
  eligibleProjects: EligibleProject[];
}

function RatingField({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-text-primary">
        {label}
      </label>
      <select
        name={name}
        required
        defaultValue="5"
        className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
      >
        <option value="5">5 - Excellent</option>
        <option value="4">4 - Good</option>
        <option value="3">3 - Solid</option>
        <option value="2">2 - Weak</option>
        <option value="1">1 - Poor</option>
      </select>
    </div>
  );
}

export default function VerifiedReviewForm({
  revieweeUserId,
  eligibleProjects,
}: VerifiedReviewFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const result = await createVerifiedReview(formData);

    if (result?.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setSuccess("Verified review posted.");
    setSaving(false);
  }

  if (eligibleProjects.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Verified reviews unlock after an awarded project with this user.
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="revieweeUserId" value={revieweeUserId} />

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-text-primary">
          Awarded project
        </label>
        <select
          name="projectId"
          required
          defaultValue={eligibleProjects[0]?.id}
          className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
        >
          {eligibleProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <RatingField name="ratingOverall" label="Overall rating" />
        <RatingField name="ratingCommunication" label="Communication" />
        <RatingField name="ratingQuality" label="Quality" />
        <RatingField name="ratingReliability" label="Reliability" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-text-primary">
            Review title
          </label>
          <input
            type="text"
            name="reviewTitle"
            disabled={saving}
            placeholder="Short headline"
            className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-text-primary">
            Would work again?
          </label>
          <select
            name="wouldWorkAgain"
            defaultValue="yes"
            disabled={saving}
            className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-text-primary">
          Verified review
        </label>
        <textarea
          name="reviewBody"
          required
          minLength={20}
          rows={4}
          disabled={saving}
          placeholder="Share what the work experience was like on this awarded project."
          className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-text-primary">
          Photos{" "}
          <span className="font-normal text-text-muted">(optional, up to 5)</span>
        </label>
        <input
          type="file"
          name="reviewPhotos"
          accept="image/*"
          multiple
          disabled={saving}
          className="block w-full text-sm text-text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
        />
        <p className="mt-1 text-xs text-text-muted">
          Attach photos of the completed work to support your review.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Posting..." : "Post Verified Review"}
      </button>
    </form>
  );
}
