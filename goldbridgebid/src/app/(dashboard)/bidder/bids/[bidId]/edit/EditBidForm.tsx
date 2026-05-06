"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import RichTextEditor from "@/components/ui/RichTextEditor";
import BidLineItemsTable from "@/components/bids/BidLineItemsTable";
import { updateBid } from "@/app/(dashboard)/bidder/projects/actions";
import type { BidLineItem } from "@/types/database";

interface EditBidFormProps {
  bidId: string;
  projectId: string;
  projectTitle: string;
  // Current bid values used to pre-fill the form
  currentPrice: number;
  currentPriceBreakdown: string | null;
  currentEstimatedTimeline: string;
  currentEstimatedStartDate: string;
  currentNotes: string | null;
  currentScopeCoverage: string;
  currentScopeDescription: string | null;
  lineItems: BidLineItem[];
  hasLineItems: boolean;
}

export default function EditBidForm({
  bidId,
  projectTitle,
  currentPrice,
  currentPriceBreakdown,
  currentEstimatedTimeline,
  currentEstimatedStartDate,
  currentNotes,
  currentScopeCoverage,
  currentScopeDescription,
  lineItems,
  hasLineItems,
}: EditBidFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopeCoverage, setScopeCoverage] = useState<"all" | "part">(
    currentScopeCoverage === "part" ? "part" : "all"
  );

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    const result = await updateBid(bidId, formData);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
    // On success, updateBid redirects to /bidder/bids — router.refresh()
    // is a fallback in case the redirect happens client-side.
    router.refresh();
  }

  return (
    <div>
      <Link
        href="/bidder/bids"
        className="mb-6 inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Bids
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Edit Bid ✏️</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Updating your bid on{" "}
          <span className="font-medium text-text-primary">{projectTitle}</span>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Heads up:</strong> Your bid is sealed — the customer has not
          seen individual bid amounts. You can update any field below while the
          project is still open.
          {hasLineItems && (
            <span>
              {" "}
              Your quick bid line items are shown below for reference but cannot
              be edited here.
            </span>
          )}
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {hasLineItems && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Quick Bid Line Items (read-only)
            </p>
            <BidLineItemsTable lineItems={lineItems} compact />
            <p className="mt-2 text-xs text-text-muted">
              The total from these line items is your bid price. To change
              individual line items, withdraw this bid and re-submit.
            </p>
          </div>
        )}

        <form action={handleSubmit} className="space-y-5">
          {/* Scope Coverage */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Does your bid cover the customer-approved scope? *
            </label>
            <select
              name="scopeCoverage"
              value={scopeCoverage}
              onChange={(e) =>
                setScopeCoverage(e.target.value as "all" | "part")
              }
              required
              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">
                Yes, all customer-approved scope items
              </option>
              <option value="part">
                No, only part of the customer-approved scope
              </option>
            </select>

            {scopeCoverage === "part" && (
              <div className="mt-3">
                <label className="block text-sm font-semibold text-text-primary mb-2">
                  What exactly does your bid include and exclude? *
                </label>
                <textarea
                  name="scopeDescription"
                  required
                  defaultValue={currentScopeDescription || ""}
                  rows={3}
                  placeholder="Describe the specific portion of the project your bid covers."
                  className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
          </div>

          {/* Price — only editable when there are no line items */}
          {!hasLineItems && (
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">
                Bid Price *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-text-muted">
                  $
                </span>
                <input
                  type="number"
                  name="price"
                  required
                  min="1"
                  step="0.01"
                  defaultValue={currentPrice}
                  className="block w-full rounded-lg border border-border bg-surface py-2.5 pl-8 pr-4 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          {/* Price Breakdown */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Price Breakdown{" "}
              <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <textarea
              name="priceBreakdown"
              rows={4}
              defaultValue={currentPriceBreakdown || ""}
              placeholder={
                hasLineItems
                  ? "Add exclusions, allowances, markups, or any extra pricing notes."
                  : "e.g.\nMaterials: $8,000\nLabor: $12,000\nOverhead/profit: $2,000"
              }
              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Timeline */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Estimated Timeline *
            </label>
            <input
              type="text"
              name="estimatedTimeline"
              required
              defaultValue={currentEstimatedTimeline}
              placeholder="e.g. 2–3 weeks, 10 business days"
              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Estimated Ability to Start *
            </label>
            <input
              type="date"
              name="estimatedStartDate"
              required
              defaultValue={
                currentEstimatedStartDate
                  ? currentEstimatedStartDate.slice(0, 10)
                  : ""
              }
              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Bid Notes / Proposal Details{" "}
              <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <RichTextEditor
              name="notes"
              defaultValue={currentNotes || ""}
              placeholder="Describe your approach, experience, scope of work, or anything else the customer should know..."
              minHeight="8rem"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-secondary-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving Changes…
                </>
              ) : (
                "Save Changes"
              )}
            </button>
            <Link
              href="/bidder/bids"
              className="flex w-full items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover sm:w-auto"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
