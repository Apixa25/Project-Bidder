"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmColor?: "red" | "amber";
  showReasonInput?: boolean;
  reasonRequired?: boolean;
  defaultReason?: string;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  confirmColor = "red",
  showReasonInput = false,
  reasonRequired = false,
  defaultReason = "",
}: ConfirmDialogProps) {
  const [reason, setReason] = useState(defaultReason);
  const [isPending, startTransition] = useTransition();

  const prevDefaultRef = { current: defaultReason };
  if (prevDefaultRef.current !== defaultReason) {
    setReason(defaultReason);
    prevDefaultRef.current = defaultReason;
  }

  if (!open) return null;

  const btnColor =
    confirmColor === "red"
      ? "bg-red-600 hover:bg-red-700"
      : "bg-amber-600 hover:bg-amber-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-text-muted hover:text-text-primary"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              {title}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          </div>
        </div>

        {showReasonInput && (
          <div className="mt-4">
            <label className="text-sm font-medium text-text-primary">
              Reason {reasonRequired && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-surface p-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Enter a reason..."
            />
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={isPending || (reasonRequired && !reason.trim())}
            onClick={() => {
              startTransition(async () => {
                await onConfirm(reason);
                setReason("");
                onClose();
              });
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${btnColor}`}
          >
            {isPending ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
