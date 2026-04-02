"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { openPaidEstimateDispute } from "./paid-estimates/actions";

const DISPUTE_REASON_OPTIONS = [
  { value: "blank_or_spam", label: "Estimate is blank or spam" },
  { value: "wrong_trade", label: "Estimate is for the wrong trade" },
  { value: "duplicate_submission", label: "Duplicate submission" },
  { value: "abusive_or_irrelevant", label: "Abusive or irrelevant content" },
  {
    value: "not_qualified_at_submission",
    label: "Contractor was not qualified at submission time",
  },
] as const;

interface DisputePaidEstimateButtonProps {
  claimId: string;
}

export default function DisputePaidEstimateButton({
  claimId,
}: DisputePaidEstimateButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof DISPUTE_REASON_OPTIONS)[number]["value"]>(
    "blank_or_spam"
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
      >
        Open Dispute
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">
            Open paid estimate dispute
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Use this only for invalid estimates. Price or customer preference is
            not a valid reason to stop payment.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-amber-900">
            Dispute reason
          </label>
          <select
            value={reason}
            onChange={(event) =>
              setReason(
                event.target.value as (typeof DISPUTE_REASON_OPTIONS)[number]["value"]
              )
            }
            className="mt-1.5 block w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-text-primary focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          >
            {DISPUTE_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-amber-900">
            Notes for review
          </label>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            placeholder="Explain the issue for company review."
            className="mt-1.5 block w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await openPaidEstimateDispute(
                  claimId,
                  reason,
                  message
                );
                if (result?.error) {
                  setError(result.error);
                  return;
                }

                setOpen(false);
                window.location.reload();
              })
            }
            disabled={isPending}
            className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
          >
            {isPending ? "Submitting..." : "Submit Dispute"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="rounded-lg border border-amber-200 bg-white px-4 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
