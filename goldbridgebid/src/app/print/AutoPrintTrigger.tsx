"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

interface AutoPrintTriggerProps {
  /**
   * If true, automatically opens the browser's Print dialog shortly after the
   * page mounts. Defaults to true. Bidders can still press the button to
   * re-open the dialog if they cancel out of it.
   */
  autoTrigger?: boolean;
  /**
   * Delay in ms before the auto print dialog opens. Lets images and fonts
   * finish loading so the printed copy looks correct.
   */
  delayMs?: number;
}

/**
 * Renders a "Print this page" toolbar that:
 *  - Auto-fires window.print() once on mount (configurable)
 *  - Provides a manual Print button so the user can re-trigger the dialog
 *  - Hides itself when the page is actually being printed (via the
 *    `print:hidden` Tailwind utility / @media print CSS)
 */
export default function AutoPrintTrigger({
  autoTrigger = true,
  delayMs = 600,
}: AutoPrintTriggerProps) {
  const [hasAutoFired, setHasAutoFired] = useState(false);

  useEffect(() => {
    if (!autoTrigger || hasAutoFired) return;
    const timer = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        // Some browsers throw if print is blocked; user can still click the button.
      }
      setHasAutoFired(true);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [autoTrigger, delayMs, hasAutoFired]);

  return (
    <div className="no-print sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-6 py-3 shadow-sm">
      <div className="text-sm text-slate-700">
        <span className="font-semibold">📄 Print-friendly view</span>
        <span className="ml-2 text-slate-500">
          Use your browser&apos;s Print dialog to print or save as PDF.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
        <button
          type="button"
          onClick={() => window.close()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          Close
        </button>
      </div>
    </div>
  );
}
