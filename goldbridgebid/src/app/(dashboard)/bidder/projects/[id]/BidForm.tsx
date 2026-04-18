"use client";

import { useState, useRef } from "react";
import { submitBid } from "../actions";
import RichTextEditor from "@/components/ui/RichTextEditor";
import type { TradeCategory } from "@/types/database";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { compressFiles } from "@/lib/compress-image";
import { BID_ATTACHMENT_FILE_ACCEPT } from "@/lib/file-uploads";

type PaidEstimateMode =
  | "not_available"
  | "eligible"
  | "ineligible"
  | "full"
  | "already_claimed";

interface BidFormProps {
  projectId: string;
  availableTrades: TradeCategory[];
  paidEstimateMode: PaidEstimateMode;
  paidEstimateReward: number | null;
  paidEstimateRemainingSlots: number;
}

export default function BidForm({
  projectId,
  availableTrades,
  paidEstimateMode,
  paidEstimateReward,
  paidEstimateRemainingSlots,
}: BidFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [scopeCoverage, setScopeCoverage] = useState<"all" | "part">("all");
  const [scopeDescription, setScopeDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // We still send a `trade` value to the backend so existing queries,
  // notifications, and paid-estimate logic continue to work. Default to
  // the first available trade — the customer-facing question is now
  // "how much of the project are you bidding on?" instead.
  const defaultTrade = availableTrades[0];

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);

    const { files: compressed } = await compressFiles(files);
    for (const file of compressed) {
      formData.append("files", file);
    }

    const result = await submitBid(formData);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  const paidEstimateNotice =
    paidEstimateMode === "eligible"
      ? {
          tone: "green",
          title: "Eligible for a paid estimate slot",
          body: `This project currently offers $${paidEstimateReward?.toLocaleString()} for each of the first ${paidEstimateRemainingSlots} remaining eligible estimate slot${paidEstimateRemainingSlots === 1 ? "" : "s"}.`,
          submitLabel: "Submit Bid For Paid Estimate Slot 🔒",
        }
      : paidEstimateMode === "ineligible"
        ? {
            tone: "amber",
            title: "You may still bid, but this estimate will be unpaid",
            body: "This project has a paid estimate pool, but you do not meet the paid eligibility filter right now.",
            submitLabel: "Submit Unpaid Sealed Bid 🔒",
          }
        : paidEstimateMode === "full"
          ? {
              tone: "amber",
              title: "Paid slots are already full",
              body: "You can still submit a sealed bid, but it will be unpaid because the funded estimate slots were claimed already.",
              submitLabel: "Submit Unpaid Sealed Bid 🔒",
            }
          : paidEstimateMode === "already_claimed"
            ? {
                tone: "blue",
                title: "You already claimed a paid slot on this project",
                body: "You may still submit another sealed bid on a different trade, but any additional bids on this project will be unpaid.",
                submitLabel: "Submit Additional Unpaid Bid 🔒",
              }
            : null;

  return (
    <form action={handleSubmit} className="space-y-6">
      <input type="hidden" name="projectId" value={projectId} />

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {paidEstimateNotice && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            paidEstimateNotice.tone === "green"
              ? "border-green-200 bg-green-50 text-green-800"
              : paidEstimateNotice.tone === "amber"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          <p className="font-semibold">{paidEstimateNotice.title}</p>
          <p className="mt-1">{paidEstimateNotice.body}</p>
        </div>
      )}

      {/* Hidden trade field — preserved for backward compat with existing
          queries, notifications, and paid-estimate logic. The user-facing
          question below is now about scope coverage. */}
      <input type="hidden" name="trade" value={defaultTrade} />

      {/* Scope Coverage */}
      <div>
        <label className="block text-sm font-semibold text-text-primary mb-2">
          How much of the project are you bidding on? *
        </label>
        <select
          name="scopeCoverage"
          value={scopeCoverage}
          onChange={(e) => setScopeCoverage(e.target.value as "all" | "part")}
          required
          className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">All of it</option>
          <option value="part">Part of it</option>
        </select>
        <p className="mt-1 text-xs text-text-muted">
          Choose &quot;All of it&quot; if your bid covers the full scope, or
          &quot;Part of it&quot; if you&apos;re bidding on only a portion of
          the project.
        </p>

        {scopeCoverage === "part" && (
          <div className="mt-3">
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Which part of the project are you bidding on? *
            </label>
            <textarea
              name="scopeDescription"
              required
              value={scopeDescription}
              onChange={(e) => setScopeDescription(e.target.value)}
              rows={3}
              placeholder="Describe the specific portion of the project your bid covers — e.g. 'Site grading and gravel pad only', 'Electrical rough-in and finish', 'Roofing only — siding excluded'."
              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-xs text-text-muted">
              Be specific so the customer knows exactly what your bid covers
              (and what it doesn&apos;t).
            </p>
          </div>
        )}
      </div>

      {/* Bid Price */}
      <div>
        <label className="block text-sm font-semibold text-text-primary mb-2">
          Bid Price (Lump Sum) *
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">
            $
          </span>
          <input
            type="number"
            name="price"
            required
            min="1"
            step="0.01"
            placeholder="25,000"
            className="block w-full rounded-lg border border-border bg-surface pl-8 pr-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Price Breakdown (optional) */}
      <div>
        <label className="block text-sm font-semibold text-text-primary mb-2">
          Price Breakdown{" "}
          <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <textarea
          name="priceBreakdown"
          rows={4}
          placeholder="e.g.&#10;Materials: $8,000&#10;Labor: $12,000&#10;Equipment rental: $3,000&#10;Overhead/profit: $2,000"
          className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1 text-xs text-text-muted">
          Breaking down your price helps customers understand your proposal.
        </p>
      </div>

      {/* Estimated Timeline */}
      <div>
        <label className="block text-sm font-semibold text-text-primary mb-2">
          Estimated Timeline *
        </label>
        <input
          type="text"
          name="estimatedTimeline"
          required
          placeholder="e.g. 2–3 weeks, 10 business days"
          className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Estimated Start Date */}
      <div>
        <label className="block text-sm font-semibold text-text-primary mb-2">
          Estimated Ability to Start *
        </label>
        <input
          type="date"
          name="estimatedStartDate"
          required
          className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1 text-xs text-text-muted">
          The earliest date you could begin work on this project.
        </p>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-semibold text-text-primary mb-2">
          Bid Notes / Proposal Details{" "}
          <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <RichTextEditor
          name="notes"
          placeholder="Describe your approach, experience with similar projects, scope of work, exclusions, or anything else the customer should know..."
          minHeight="8rem"
        />
      </div>

      {/* File Uploads */}
      <div>
        <label className="block text-sm font-semibold text-text-primary mb-2">
          Attachments{" "}
          <span className="font-normal text-text-muted">
            (proposals, estimates, reference photos, etc.)
          </span>
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-lg border-2 border-dashed border-border bg-bg-warm px-6 py-8 text-center hover:border-secondary/50 transition-colors"
        >
          <Upload className="mx-auto h-8 w-8 text-text-muted" />
          <p className="mt-2 text-sm font-medium text-text-secondary">
            Click to upload files
          </p>
          <p className="mt-1 text-xs text-text-muted">
            PDFs, images, spreadsheets, and documents — up to 50MB each
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={BID_ATTACHMENT_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2"
              >
                <FileText className="h-4 w-4 text-secondary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="rounded-full p-1 hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-secondary px-6 py-3 text-base font-bold text-white shadow-sm hover:bg-secondary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Submitting Bid...
          </>
        ) : (
          paidEstimateNotice?.submitLabel || "Submit Sealed Bid 🔒"
        )}
      </button>

      <p className="text-center text-xs text-text-muted">
        Your bid is sealed — only the project owner can see it. Other bidders
        cannot see your submission.
      </p>
    </form>
  );
}
