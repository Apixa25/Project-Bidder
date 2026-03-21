"use client";

import { useState } from "react";
import { resolveFlag } from "./actions";
import { Flag, CheckCircle2, AlertTriangle } from "lucide-react";

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

export default function FlaggedContentList({
  flags: initial,
  reporterMap,
}: {
  flags: FlagData[];
  reporterMap: Record<string, ReporterData>;
}) {
  const [flags, setFlags] = useState(initial);

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
              return (
                <div
                  key={flag.id}
                  className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-red-500 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                            {flag.content_type}
                          </span>
                          <span className="text-xs text-text-muted">
                            ID: {flag.content_id.slice(0, 8)}...
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-text-primary">
                          {flag.reason}
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                          Reported by {reporter?.full_name || "Unknown"} on{" "}
                          {new Date(flag.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleResolve(flag.id)}
                      className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
                    >
                      Mark Resolved
                    </button>
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
              const reporter = reporterMap[flag.reporter_id];
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
                        {flag.reason}
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
    </div>
  );
}
