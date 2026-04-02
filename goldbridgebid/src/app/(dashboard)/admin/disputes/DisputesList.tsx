"use client";

import Link from "next/link";
import { useState } from "react";
import { resolvePaidEstimateDispute } from "@/app/(dashboard)/admin/actions";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface DisputeItem {
  id: string;
  project_id: string;
  bid_id: string;
  bidder_id: string;
  reason: string;
  customer_message: string | null;
  review_status: "open" | "resolved_paid" | "resolved_denied";
  review_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  projectTitle: string;
  bidderName: string;
}

export default function DisputesList({ disputes }: { disputes: DisputeItem[] }) {
  const [selected, setSelected] = useState<{
    disputeId: string;
    decision: "pay" | "deny";
  } | null>(null);

  if (disputes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-12 text-center shadow-sm">
        <p className="text-sm text-text-muted">No disputes match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {disputes.map((dispute) => (
        <article
          key={dispute.id}
          className="rounded-xl border border-border bg-surface p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    dispute.review_status === "open"
                      ? "bg-amber-100 text-amber-800"
                      : dispute.review_status === "resolved_paid"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {dispute.review_status.replace(/_/g, " ")}
                </span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {dispute.reason.replace(/_/g, " ")}
                </span>
              </div>

              <h2 className="mt-3 text-base font-semibold text-text-primary">
                <Link
                  href={`/admin/projects/${dispute.project_id}`}
                  className="hover:text-primary"
                >
                  {dispute.projectTitle}
                </Link>
              </h2>

              <p className="mt-2 text-sm text-text-secondary">
                Bidder:{" "}
                <Link
                  href={`/admin/users/${dispute.bidder_id}`}
                  className="text-primary hover:underline"
                >
                  {dispute.bidderName}
                </Link>
              </p>

              {dispute.customer_message && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                  {dispute.customer_message}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-muted">
                <span>Opened {new Date(dispute.created_at).toLocaleString()}</span>
                {dispute.resolved_at && (
                  <span>Resolved {new Date(dispute.resolved_at).toLocaleString()}</span>
                )}
              </div>
            </div>

            {dispute.review_status === "open" && (
              <div className="flex flex-wrap gap-2 lg:w-44 lg:flex-col">
                <button
                  type="button"
                  onClick={() =>
                    setSelected({ disputeId: dispute.id, decision: "pay" })
                  }
                  className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-700"
                >
                  Approve Payout
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelected({ disputeId: dispute.id, decision: "deny" })
                  }
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                >
                  Deny Payout
                </button>
              </div>
            )}
          </div>
        </article>
      ))}

      <ConfirmDialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onConfirm={async (reason) => {
          if (!selected) return;
          await resolvePaidEstimateDispute(
            selected.disputeId,
            selected.decision,
            reason
          );
          window.location.reload();
        }}
        title={
          selected?.decision === "deny"
            ? "Deny Paid Estimate Payout"
            : "Approve Paid Estimate Payout"
        }
        description={
          selected?.decision === "deny"
            ? "Resolve this dispute by denying the payout and refunding the reserved amount."
            : "Resolve this dispute by keeping the estimate payable."
        }
        confirmLabel={selected?.decision === "deny" ? "Deny Payout" : "Approve Payout"}
        confirmColor={selected?.decision === "deny" ? "red" : "amber"}
        showReasonInput
      />
    </div>
  );
}
