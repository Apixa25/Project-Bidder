"use client";

import { Printer } from "lucide-react";

interface PrintProjectButtonProps {
  projectId: string;
  /**
   * Optional override for the button label. Defaults to "Print Project" so
   * the same component reads naturally on the bidder, customer, and admin
   * project pages.
   */
  label?: string;
  /**
   * Optional override for the hover tooltip.
   */
  title?: string;
  /**
   * Visual variant.
   *  - "default" — light surface button with primary icon (used in the bidder
   *    and customer page headers)
   *  - "muted"   — slimmer, lower-emphasis style for the admin moderation view
   */
  variant?: "default" | "muted";
}

/**
 * Opens the print-friendly project summary at `/print/projects/[id]` in a
 * new tab. The summary page auto-fires the browser's print dialog so users
 * can immediately print or save as PDF.
 *
 * The same `/print/projects/[id]` route is auth-aware and serves:
 *   - the customer who owns the project
 *   - any bidder when the project is open
 *   - any admin
 */
export default function PrintProjectButton({
  projectId,
  label = "Print Project",
  title = "Print or save the full project description as a PDF",
  variant = "default",
}: PrintProjectButtonProps) {
  const className =
    variant === "muted"
      ? "inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary shadow-sm transition-colors hover:bg-surface-hover"
      : "inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:bg-surface-hover";

  const iconClassName =
    variant === "muted" ? "h-3.5 w-3.5 text-primary" : "h-4 w-4 text-primary";

  return (
    <button
      type="button"
      onClick={() => {
        window.open(`/print/projects/${projectId}`, "_blank", "noopener");
      }}
      className={className}
      title={title}
    >
      <Printer className={iconClassName} />
      {label}
    </button>
  );
}
