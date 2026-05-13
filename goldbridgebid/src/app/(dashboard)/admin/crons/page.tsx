import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Timer,
  Clock,
  Hash,
} from "lucide-react";

const KNOWN_JOBS = [
  {
    name: "process-paid-estimate-payouts",
    label: "Process Paid Estimate Payouts",
    description: "Processes payout transfers for approved paid estimate claims.",
  },
  {
    name: "release-paid-estimates",
    label: "Release Paid Estimates",
    description: "Releases reserved paid estimate slots that have completed their hold period.",
  },
  {
    name: "refund-unused-paid-estimates",
    label: "Refund Unused Paid Estimates",
    description: "Refunds expired and unclaimed paid estimate pool funds to customers.",
  },
  {
    name: "process-estimator-package-payouts",
    label: "Process Estimator Package Payouts",
    description: "Processes payout transfers for sold estimator packages.",
  },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function AdminCronsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/login");

  const { data: recentRuns } = await supabase
    .from("cron_job_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(100);

  const runsByJob: Record<string, typeof recentRuns> = {};
  for (const run of recentRuns || []) {
    if (!runsByJob[run.job_name]) runsByJob[run.job_name] = [];
    runsByJob[run.job_name]!.push(run);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Cron Jobs ⏱️
        </h1>
        <p className="mt-1 text-text-secondary">
          Health and status of automated background tasks.
        </p>
      </div>

      {/* Job Cards */}
      <div className="space-y-6">
        {KNOWN_JOBS.map((job) => {
          const runs = runsByJob[job.name] || [];
          const lastRun = runs[0];
          const lastSuccessRun = runs.find((r) => r.status === "success");
          const failCount = runs.filter((r) => r.status === "failed").length;

          const statusIcon =
            !lastRun ? (
              <div className="flex items-center gap-1.5 text-text-muted">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium">Never run</span>
              </div>
            ) : lastRun.status === "running" ? (
              <div className="flex items-center gap-1.5 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs font-medium">Running</span>
              </div>
            ) : lastRun.status === "success" ? (
              <div className="flex items-center gap-1.5 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Healthy</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-red-600">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Last run failed</span>
              </div>
            );

          return (
            <div
              key={job.name}
              className="rounded-xl border border-border bg-surface p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Timer className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">
                      {job.label}
                    </h3>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {job.description}
                    </p>
                  </div>
                </div>
                {statusIcon}
              </div>

              {/* Stats Row */}
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-bg-warm px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-text-muted">
                    Last Run
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {lastRun ? timeAgo(lastRun.started_at) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-warm px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-text-muted">
                    Last Success
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {lastSuccessRun ? timeAgo(lastSuccessRun.started_at) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-warm px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-text-muted">
                    Total Runs
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {runs.length}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-warm px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-text-muted">
                    Failures
                  </p>
                  <p className={`mt-0.5 text-sm font-medium ${failCount > 0 ? "text-red-600" : "text-text-primary"}`}>
                    {failCount}
                  </p>
                </div>
              </div>

              {/* Recent Runs */}
              {runs.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-text-muted uppercase tracking-wide">
                    Recent Runs
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {runs.slice(0, 10).map((run) => (
                      <div
                        key={run.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-bg-warm px-3 py-2 text-xs"
                      >
                        {run.status === "success" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        ) : run.status === "failed" ? (
                          <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        ) : (
                          <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin shrink-0" />
                        )}
                        <span className="text-text-primary">
                          {new Date(run.started_at).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1 text-text-muted">
                          <Hash className="h-3 w-3" />
                          {run.items_processed} processed
                        </div>
                        {run.completed_at && (
                          <span className="text-text-muted">
                            {Math.round(
                              (new Date(run.completed_at).getTime() -
                                new Date(run.started_at).getTime()) /
                                1000
                            )}s
                          </span>
                        )}
                        {run.error_message && (
                          <span className="text-red-600 truncate max-w-[200px]" title={run.error_message}>
                            {run.error_message}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* No Data State */}
      {(!recentRuns || recentRuns.length === 0) && (
        <div className="mt-6 rounded-xl border border-border bg-surface py-12 text-center shadow-sm">
          <Timer className="mx-auto h-10 w-10 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            No cron job runs recorded yet. Runs will appear once the cron tracking helper is active.
          </p>
        </div>
      )}
    </div>
  );
}
