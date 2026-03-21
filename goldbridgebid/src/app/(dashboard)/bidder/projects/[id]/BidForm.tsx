"use client";

import { useState, useRef } from "react";
import { submitBid } from "../actions";
import { TRADE_LABELS } from "@/types/database";
import type { TradeCategory } from "@/types/database";
import { Upload, X, FileText, Loader2 } from "lucide-react";

interface BidFormProps {
  projectId: string;
  availableTrades: TradeCategory[];
}

export default function BidForm({ projectId, availableTrades }: BidFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    for (const file of files) {
      formData.append("files", file);
    }

    const result = await submitBid(formData);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <input type="hidden" name="projectId" value={projectId} />

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Trade Selection */}
      <div>
        <label className="block text-sm font-semibold text-text-primary mb-2">
          Which trade are you bidding on? *
        </label>
        <select
          name="trade"
          required
          className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {availableTrades.map((trade) => (
            <option key={trade} value={trade}>
              {TRADE_LABELS[trade]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-text-muted">
          Select the specific trade you are bidding for on this project.
        </p>
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
        <textarea
          name="notes"
          rows={5}
          placeholder="Describe your approach, experience with similar projects, scope of work, exclusions, or anything else the customer should know..."
          className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
            PDFs, images, documents — anything to support your bid
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
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
          "Submit Sealed Bid 🔒"
        )}
      </button>

      <p className="text-center text-xs text-text-muted">
        Your bid is sealed — only the project owner can see it. Other bidders
        cannot see your submission.
      </p>
    </form>
  );
}
