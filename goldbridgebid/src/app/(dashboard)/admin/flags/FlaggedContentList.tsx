"use client";

import { useState } from "react";
import Link from "next/link";
import {
  resolveFlag,
  dismissFlag,
  banUser,
  hideReview,
  deleteReview,
} from "@/app/(dashboard)/admin/actions";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import {
  Flag,
  CheckCircle2,
  AlertTriangle,
  Eye,
  ShieldOff,
  X,
} from "lucide-react";

interface FlagData {
  id: string;
  reporter_id: string;
  content_type: string;
  content_id: string;
  reason: string;
  resolved: boolean;
  created_at: string;
}

interface ReporterData {
  full_name: string;
  email: string;
}

interface Props {
  flags: FlagData[];
  reporterMap: Record<string, ReporterData>;
  contentPreviews: Record<string, string>;
  reviewMetaMap: Record<
    string,
    { reviewId: string; revieweeUserId: string | null; status: string }
  >;
}

const TYPE_LINKS: Record<string, (id: string) => string> = {
  project: (id) => `/admin/projects/${id}`,
  bid: (id) => `/admin/bids?q=${id}`,
  user: (id) => `/admin/users/${id}`,
  message: (id) => `/admin/messages?q=${id}`,
};

export default function FlaggedContentList({
  flags: initial,
  reporterMap,
  contentPreviews,
  reviewMetaMap,
}: Props) {
  const [flags, setFlags] = useState(initial);
  const [showBan, setShowBan] = useState<{
    flagId: string;
    contentId: string;
  } | null>(null);
  const [showDismiss, setShowDismiss] = useState<string | null>(null);

  async function handleResolve(flagId: string) {
    await resolveFlag(flagId);
    setFlags((prev) =>
      prev.map((f) => (f.id === flagId ? { ...f, resolved: true } : f))
    );
  }

  const unresolved = flags.filter((f) => !f.resolved);
  const resolved = flags.filter((f) => f.resolved);

  return (
    <div className="space-y-8">
      {/* Unresolved */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Unresolved ({unresolved.length})
        </h2>
        {unresolved.length > 0 ? (
          <div className="space-y-3">
            {unresolved.map((flag) => {
              const reporter = reporterMap[flag.reporter_id];
              const preview = contentPreviews[flag.id];
              const reviewMeta = reviewMetaMap[flag.id];
              const viewLink =
                flag.content_type === "review" && reviewMeta?.revieweeUserId
                  ? `/profile/${reviewMeta.revieweeUserId}`
                  : TYPE_LINKS[flag.content_type]?.(flag.content_id);

              return (
                <div
                  key={flag.id}
                  className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-red-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                            {flag.content_type}
                          </span>
                          <span className="text-xs text-text-muted">
                            ID: {flag.content_id.slice(0, 8)}...
                          </span>
                        </div>

                        {/* Content Preview */}
                        {preview && (
                          <div className="mt-2 rounded-lg bg-white/60 border border-red-100 px-3 py-2">
                            <p className="text-xs font-medium text-text-muted">
                              Flagged Content:
                            </p>
                            <p className="text-sm text-text-primary">
                              {preview}
                            </p>
                          </div>
                        )}

                        <p className="mt-2 text-sm text-text-primary">
                          <span className="font-medium">Reason:</span>{" "}
                          {flag.reason}
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                          Reported by{" "}
                          {reporter?.full_name || "Unknown"} on{" "}
                          {new Date(flag.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleResolve(flag.id)}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Resolve
                      </button>
                      <button
                        onClick={() => setShowDismiss(flag.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                        Dismiss
                      </button>
                      {flag.content_type === "user" && (
                        <button
                          onClick={() =>
                            setShowBan({
                              flagId: flag.id,
                              contentId: flag.content_id,
                            })
                          }
                          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                          Ban User
                        </button>
                      )}
                      {flag.content_type === "review" && reviewMeta && (
                        <>
                          <button
                            onClick={async () => {
                              await hideReview(reviewMeta.reviewId, flag.id);
                              setFlags((prev) =>
                                prev.map((f) =>
                                  f.id === flag.id ? { ...f, resolved: true } : f
                                )
                              );
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                            Hide Review
                          </button>
                          <button
                            onClick={async () => {
                              await deleteReview(reviewMeta.reviewId, flag.id);
                              setFlags((prev) =>
                                prev.map((f) =>
                                  f.id === flag.id ? { ...f, resolved: true } : f
                                )
                              );
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                            Delete Review
                          </button>
                        </>
                      )}
                      {viewLink && (
                        <Link
                          href={viewLink}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface py-12 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-400" />
            <p className="mt-3 text-sm font-medium text-text-secondary">
              No unresolved flags — everything looks clean! 🎉
            </p>
          </div>
        )}
      </section>

      {/* Resolved */}
      {resolved.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-text-muted">
            Resolved ({resolved.length})
          </h2>
          <div className="space-y-2">
            {resolved.map((flag) => {
              return (
                <div
                  key={flag.id}
                  className="rounded-xl border border-border bg-surface p-4 shadow-sm opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <Flag className="h-4 w-4 text-text-muted shrink-0" />
                    <div className="flex-1">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        {flag.content_type}
                      </span>
                      <span className="ml-2 text-sm text-text-muted">
                        {flag.reason.length > 80
                          ? flag.reason.slice(0, 80) + "..."
                          : flag.reason}
                      </span>
                    </div>
                    <span className="text-xs text-green-600 font-medium">
                      ✓ Resolved
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={!!showBan}
        onClose={() => setShowBan(null)}
        onConfirm={async (reason) => {
          if (showBan) {
            await banUser(showBan.contentId, reason);
            await handleResolve(showBan.flagId);
            setShowBan(null);
          }
        }}
        title="Ban Flagged User"
        description="Ban this user and resolve the flag. They will be immediately blocked from the platform."
        confirmLabel="Ban & Resolve"
        confirmColor="amber"
        showReasonInput
        reasonRequired
      />

      <ConfirmDialog
        open={!!showDismiss}
        onClose={() => setShowDismiss(null)}
        onConfirm={async (note) => {
          if (showDismiss) {
            await dismissFlag(showDismiss, note);
            setFlags((prev) =>
              prev.map((f) =>
                f.id === showDismiss ? { ...f, resolved: true } : f
              )
            );
            setShowDismiss(null);
          }
        }}
        title="Dismiss Flag"
        description="Dismiss this flag without taking action. You can add a note for the audit log."
        confirmLabel="Dismiss"
        confirmColor="amber"
        showReasonInput
      />
    </div>
  );
}
