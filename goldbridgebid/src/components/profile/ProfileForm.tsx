"use client";

import { useState } from "react";
import { updateProfile } from "@/app/(dashboard)/profile/actions";
import { Loader2, CheckCircle2 } from "lucide-react";
import {
  FORM_TRADES,
  TRADE_LABELS,
  type TradeCategory,
} from "@/types/database";

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
  years_in_business: number | null;
  available_for_work: boolean;
  service_radius_miles: number | null;
  role: string;
}

export interface ServiceAreaEntry {
  state: string;
  city: string | null;
}

export default function ProfileForm({
  profile,
  editorRole = profile.role,
  selectedSpecialties = [],
  serviceAreas = [],
}: {
  profile: ProfileData;
  editorRole?: string;
  selectedSpecialties?: TradeCategory[];
  serviceAreas?: ServiceAreaEntry[];
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [areas, setAreas] = useState<ServiceAreaEntry[]>(serviceAreas);
  const [newAreaState, setNewAreaState] = useState("");
  const [newAreaCity, setNewAreaCity] = useState("");

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
      <input type="hidden" name="editorRole" value={editorRole} />

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
        {editorRole === "bidder" && (
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
            editorRole === "bidder"
              ? "Tell customers about your experience, specialties, and what makes your work stand out..."
              : "Tell us about yourself and the types of projects you typically work on..."
          }
          className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {editorRole === "bidder" && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              Years in Business
            </label>
            <input
              type="number"
              name="yearsInBusiness"
              min={0}
              max={100}
              defaultValue={profile.years_in_business ?? ""}
              placeholder="e.g. 15"
              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              Service Radius (miles)
            </label>
            <input
              type="number"
              name="serviceRadiusMiles"
              min={0}
              max={500}
              defaultValue={profile.service_radius_miles ?? 50}
              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-3 rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary w-full">
              <input
                type="checkbox"
                name="availableForWork"
                defaultChecked={profile.available_for_work}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="font-medium">Available for work</span>
            </label>
          </div>
        </div>
      )}

      {editorRole === "bidder" && (
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">
            Service Areas{" "}
            <span className="font-normal text-text-muted">(where you work)</span>
          </label>
          <p className="mb-3 text-sm text-text-muted">
            Add the states and cities you serve so customers see projects in your area.
          </p>
          {areas.map((area, index) => (
            <input
              key={`${area.state}-${area.city ?? "all"}-${index}`}
              type="hidden"
              name="serviceAreas"
              value={JSON.stringify(area)}
            />
          ))}
          <div className="space-y-2 mb-3">
            {areas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {areas.map((area, index) => (
                  <span
                    key={`${area.state}-${area.city ?? "all"}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3 py-1.5 text-sm font-medium text-secondary"
                  >
                    {area.city ? `${area.city}, ${area.state}` : `All of ${area.state}`}
                    <button
                      type="button"
                      onClick={() =>
                        setAreas((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="ml-0.5 text-secondary/60 hover:text-red-500 transition-colors"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                No service areas set — you&apos;ll see all projects regardless of location.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <input
                type="text"
                placeholder="State (e.g. CA)"
                maxLength={2}
                value={newAreaState}
                onChange={(e) => setNewAreaState(e.target.value.toUpperCase())}
                className="w-20 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="City (optional)"
                value={newAreaCity}
                onChange={(e) => setNewAreaCity(e.target.value)}
                className="w-44 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!newAreaState.trim()) return;
                const entry: ServiceAreaEntry = {
                  state: newAreaState.trim().toUpperCase(),
                  city: newAreaCity.trim() || null,
                };
                const isDuplicate = areas.some(
                  (a) => a.state === entry.state && a.city === entry.city
                );
                if (!isDuplicate) {
                  setAreas((prev) => [...prev, entry]);
                }
                setNewAreaState("");
                setNewAreaCity("");
              }}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
            >
              Add Area
            </button>
          </div>
        </div>
      )}

      {editorRole === "bidder" && (
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">
            Contractor Specialties{" "}
            <span className="font-normal text-text-muted">(recommended)</span>
          </label>
          <p className="mb-3 text-sm text-text-muted">
            Pick the trades you want customers to find you under in the
            contractor directory.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {FORM_TRADES.map((trade) => (
              <label
                key={trade}
                className="flex items-start gap-3 rounded-lg border border-border bg-bg-warm px-3 py-2.5 text-sm text-text-primary transition-colors hover:border-primary/40"
              >
                <input
                  type="checkbox"
                  name="specialties"
                  value={trade}
                  defaultChecked={selectedSpecialties.includes(trade)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>{TRADE_LABELS[trade]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

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
