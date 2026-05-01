"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { updateEstimatorProfile } from "./actions";
import type { EstimatorProfile } from "@/types/database";

interface EstimatorProfileFormProps {
  profile: {
    full_name: string;
    business_name: string | null;
    email: string;
  };
  estimatorProfile: EstimatorProfile | null;
}

export default function EstimatorProfileForm({
  profile,
  estimatorProfile,
}: EstimatorProfileFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const defaultDisplayName =
    estimatorProfile?.display_name ||
    profile.business_name ||
    profile.full_name ||
    profile.email;

  function handleSubmit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await updateEstimatorProfile(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      setMessage("Estimator profile saved.");
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="displayName"
          className="mb-1.5 block text-sm font-medium text-text-primary"
        >
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          defaultValue={defaultDisplayName}
          className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
        />
        <p className="mt-1 text-xs text-text-muted">
          This name appears on estimate packages and marketplace previews.
        </p>
      </div>

      <div>
        <label
          htmlFor="headline"
          className="mb-1.5 block text-sm font-medium text-text-primary"
        >
          Professional headline
        </label>
        <input
          id="headline"
          name="headline"
          type="text"
          defaultValue={estimatorProfile?.headline || ""}
          placeholder="Example: Residential remodel takeoffs and bid-ready scopes"
          className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
        />
      </div>

      <div>
        <label
          htmlFor="serviceArea"
          className="mb-1.5 block text-sm font-medium text-text-primary"
        >
          Service area
        </label>
        <input
          id="serviceArea"
          name="serviceArea"
          type="text"
          defaultValue={estimatorProfile?.service_area || ""}
          placeholder="Example: California, Pacific Northwest, nationwide remote"
          className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
        />
      </div>

      <div>
        <label
          htmlFor="websiteUrl"
          className="mb-1.5 block text-sm font-medium text-text-primary"
        >
          Website
        </label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          type="url"
          defaultValue={estimatorProfile?.website_url || ""}
          placeholder="https://example.com"
          className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
        />
      </div>

      <div>
        <label
          htmlFor="bio"
          className="mb-1.5 block text-sm font-medium text-text-primary"
        >
          Estimator bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={6}
          defaultValue={estimatorProfile?.bio || ""}
          placeholder="Explain the kinds of estimates you prepare, your experience, and what buyers can expect from your packages."
          className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-accent-light px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {isPending ? "Saving..." : "Save Estimator Profile"}
      </button>
    </form>
  );
}

