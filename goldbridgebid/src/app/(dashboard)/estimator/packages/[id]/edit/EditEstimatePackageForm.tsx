"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { updateEstimatePackage } from "../../actions";
import {
  FORM_TRADES,
  TRADE_LABELS,
  type EstimatePackage,
  type EstimatePackageType,
  type EstimatePackageVersion,
  type TradeCategory,
} from "@/types/database";

const PACKAGE_TYPE_OPTIONS: Array<{
  value: EstimatePackageType;
  label: string;
  description: string;
}> = [
  {
    value: "material_takeoff",
    label: "Material Takeoff",
    description: "Quantities, materials, and scope assumptions.",
  },
  {
    value: "bid_ready_scope",
    label: "Bid-Ready Scope",
    description: "A scope package contractors can use as a bid starting point.",
  },
  {
    value: "estimate_worksheet",
    label: "Estimate Worksheet",
    description: "Structured estimating logic, notes, and line-item guidance.",
  },
  {
    value: "plan_review",
    label: "Plan Review",
    description: "Constructability notes, missing items, and risk callouts.",
  },
  {
    value: "other",
    label: "Other",
    description: "A specialized estimating package that does not fit above.",
  },
];

interface EditEstimatePackageFormProps {
  packageRow: EstimatePackage;
  version: EstimatePackageVersion;
  hasPurchases: boolean;
}

export default function EditEstimatePackageForm({
  packageRow,
  version,
  hasPurchases,
}: EditEstimatePackageFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedTrades = new Set(packageRow.trades as TradeCategory[]);

  function handleSubmit(formData: FormData) {
    setError(null);
    setMessage(null);
    formData.set("packageId", packageRow.id);

    startTransition(async () => {
      const result = await updateEstimatePackage(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (result && "revisionCreated" in result && result.revisionCreated) {
        setMessage(
          "A new draft revision was created because buyers already had access to the published version. Add or adjust files on the package page, then publish the new version when it is ready."
        );
      } else {
        setMessage("Package changes saved.");
      }

      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      {packageRow.status === "published" && hasPurchases && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900">
          This package already has buyer access. Saving changes will create a new
          draft version instead of changing what previous buyers purchased.
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-text-primary">
          Package Basics
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-text-secondary">
          Edit the marketplace listing buyers see before purchasing.
        </p>

        <div className="grid gap-5">
          <div>
            <label
              htmlFor="title"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Package title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              defaultValue={packageRow.title}
              className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="summary"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Marketplace summary
            </label>
            <textarea
              id="summary"
              name="summary"
              rows={4}
              required
              defaultValue={packageRow.summary}
              className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="packageType"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Package type
            </label>
            <select
              id="packageType"
              name="packageType"
              required
              defaultValue={packageRow.package_type}
              className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            >
              {PACKAGE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PACKAGE_TYPE_OPTIONS.map((option) => (
                <p
                  key={option.value}
                  className="rounded-lg border border-border bg-bg-warm/50 px-3 py-2 text-xs text-text-muted"
                >
                  <span className="font-semibold text-text-secondary">
                    {option.label}:
                  </span>{" "}
                  {option.description}
                </p>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="price"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Price in USD
            </label>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={(packageRow.price_cents / 100).toFixed(2)}
              className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            />
            <p className="mt-1 text-xs text-text-muted">
              Use 0.00 for a free package.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-text-primary">
          Scope Snapshot
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-text-secondary">
          These details are stored with the package version buyers access.
        </p>

        <div className="space-y-5">
          <div>
            <label
              htmlFor="scopeOverview"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Scope overview
            </label>
            <textarea
              id="scopeOverview"
              name="scopeOverview"
              rows={5}
              defaultValue={version.scope_overview || ""}
              className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label
                htmlFor="assumptions"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Assumptions
              </label>
              <textarea
                id="assumptions"
                name="assumptions"
                rows={6}
                defaultValue={(version.assumptions_json || []).join("\n")}
                className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
              />
            </div>

            <div>
              <label
                htmlFor="exclusions"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Exclusions
              </label>
              <textarea
                id="exclusions"
                name="exclusions"
                rows={6}
                defaultValue={(version.exclusions_json || []).join("\n")}
                className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-text-primary">Trades</h2>
        <p className="mb-5 text-sm leading-relaxed text-text-secondary">
          Select the trades this package applies to. Leaving all unchecked keeps
          it general.
        </p>
        <div className="grid max-h-80 gap-2 overflow-y-auto rounded-lg border border-border bg-bg-warm p-3 sm:grid-cols-2 lg:grid-cols-3">
          {FORM_TRADES.map((trade) => (
            <label
              key={trade}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface"
            >
              <input
                type="checkbox"
                name="trades"
                value={trade}
                defaultChecked={selectedTrades.has(trade)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              {TRADE_LABELS[trade]}
            </label>
          ))}
        </div>
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

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/estimator/packages/${packageRow.id}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Package
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-light px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
