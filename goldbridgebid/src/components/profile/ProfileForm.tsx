"use client";

import { useState } from "react";
import { updateProfile } from "@/app/(dashboard)/profile/actions";
import { Loader2, CheckCircle2 } from "lucide-react";

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  bio: string | null;
  business_name: string | null;
  role: string;
}

export default function ProfileForm({ profile }: { profile: ProfileData }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const result = await updateProfile(formData);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200">
          <CheckCircle2 className="h-4 w-4" />
          Profile updated successfully!
        </div>
      )}

      {/* Name & Business */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">
            Full Name *
          </label>
          <input
            type="text"
            name="fullName"
            required
            defaultValue={profile.full_name}
            className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {profile.role === "bidder" && (
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              Business Name
            </label>
            <input
              type="text"
              name="businessName"
              defaultValue={profile.business_name || ""}
              placeholder="Your company name"
              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">
            Email
          </label>
          <input
            type="email"
            disabled
            value={profile.email}
            className="block w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-text-muted cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-text-muted">
            Email cannot be changed here.
          </p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">
            Phone *
          </label>
          <input
            type="tel"
            name="phone"
            required
            defaultValue={profile.phone}
            className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-semibold text-text-primary mb-1.5">
          Street Address *
        </label>
        <input
          type="text"
          name="address"
          required
          defaultValue={profile.address}
          className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">
            City
          </label>
          <input
            type="text"
            name="city"
            defaultValue={profile.city}
            className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">
            State
          </label>
          <input
            type="text"
            name="state"
            defaultValue={profile.state}
            maxLength={2}
            placeholder="CA"
            className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">
            ZIP Code
          </label>
          <input
            type="text"
            name="zip"
            defaultValue={profile.zip}
            maxLength={10}
            placeholder="95531"
            className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-semibold text-text-primary mb-1.5">
          Bio{" "}
          <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <textarea
          name="bio"
          rows={4}
          defaultValue={profile.bio || ""}
          placeholder={
            profile.role === "bidder"
              ? "Tell customers about your experience, specialties, and what makes your work stand out..."
              : "Tell us about yourself and the types of projects you typically work on..."
          }
          className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>
    </form>
  );
}
