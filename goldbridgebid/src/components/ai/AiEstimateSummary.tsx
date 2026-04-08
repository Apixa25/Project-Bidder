import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  FileSearch,
  Lightbulb,
} from "lucide-react";
import type {
  ProjectAiEstimateStatus,
  ProjectAiConfidenceLevel,
  ProjectAiRecommendedQuestion,
  ProjectAiTradeBreakdownItem,
} from "@/lib/ai-estimates";

interface AiEstimateSummaryProps {
  status: ProjectAiEstimateStatus;
  score: number;
  confidence: ProjectAiConfidenceLevel;
  summary: string;
  baselineLow: number | null;
  baselineHigh: number | null;
  assumptions: string[];
  exclusions?: string[];
  missingItems?: string[];
  questions?: ProjectAiRecommendedQuestion[];
  tradeBreakdown?: ProjectAiTradeBreakdownItem[];
  compact?: boolean;
}

function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not ready yet";
  }

  return `$${value.toLocaleString()}`;
}

function getStatusConfig(status: ProjectAiEstimateStatus) {
  switch (status) {
    case "ready":
      return {
        label: "Estimate-ready",
        className: "bg-green-100 text-green-800",
        Icon: CheckCircle2,
      };
    case "stale":
      return {
        label: "Needs review",
        className: "bg-amber-100 text-amber-800",
        Icon: AlertCircle,
      };
    case "needs_clarification":
      return {
        label: "Needs clarification",
        className: "bg-blue-100 text-blue-800",
        Icon: CircleHelp,
      };
    default:
      return {
        label: "Not enough information",
        className: "bg-slate-100 text-slate-700",
        Icon: FileSearch,
      };
  }
}

function getConfidenceClass(confidence: ProjectAiConfidenceLevel) {
  if (confidence === "high") return "text-green-700";
  if (confidence === "medium") return "text-blue-700";
  return "text-amber-700";
}

export default function AiEstimateSummary({
  status,
  score,
  confidence,
  summary,
  baselineLow,
  baselineHigh,
  assumptions,
  exclusions = [],
  missingItems = [],
  questions = [],
  tradeBreakdown = [],
  compact = false,
}: AiEstimateSummaryProps) {
  const statusConfig = getStatusConfig(status);
  const StatusIcon = statusConfig.Icon;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusConfig.className}`}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {statusConfig.label}
            </span>
            <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
              Scope score {score}/100
            </span>
            <span
              className={`rounded-full bg-surface px-3 py-1 text-xs font-medium ${getConfidenceClass(
                confidence
              )}`}
            >
              {confidence[0].toUpperCase() + confidence.slice(1)} confidence
            </span>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">
            {summary}
          </p>
        </div>

        <div className="min-w-[220px] rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Baseline range
          </p>
          <p className="mt-1 text-lg font-bold text-money">
            {baselineLow !== null && baselineHigh !== null
              ? `${formatCurrency(baselineLow)} - ${formatCurrency(baselineHigh)}`
              : "Not ready yet"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Planning baseline only, not a contractor quote.
          </p>
        </div>
      </div>

      {!compact && tradeBreakdown.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {tradeBreakdown.map((item) => (
            <div
              key={item.trade}
              className="rounded-lg border border-border bg-bg-warm px-4 py-3"
            >
              <p className="text-sm font-semibold text-text-primary">
                {item.label}
              </p>
              <p className="mt-1 text-sm text-money font-semibold">
                {item.estimated_low !== null && item.estimated_high !== null
                  ? `${formatCurrency(item.estimated_low)} - ${formatCurrency(
                      item.estimated_high
                    )}`
                  : "Need more signal"}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {item.source === "historical_bids"
                  ? `${item.benchmark_count} internal bids informed this trade range.`
                  : item.source === "budget_signal"
                    ? "Budget signal used because internal bid data was limited."
                    : "Not enough historical signal for a trade-level range yet."}
              </p>
            </div>
          ))}
        </div>
      )}

      {!compact && missingItems.length > 0 && (
        <div className="rounded-xl border border-border bg-surface px-5 py-4">
          <div className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text-primary">
              Missing information
            </h3>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingItems.map((item) => (
              <span
                key={item}
                className="rounded-full bg-bg-warm px-3 py-1 text-xs text-text-secondary"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface px-5 py-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text-primary">
              Assumptions
            </h3>
          </div>
          <div className="mt-3 space-y-2">
            {assumptions.map((item) => (
              <p key={item} className="text-sm leading-relaxed text-text-secondary">
                {item}
              </p>
            ))}
          </div>
        </div>

        {!compact && exclusions.length > 0 && (
          <div className="rounded-xl border border-border bg-surface px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-text-primary">
                Exclusions and guardrails
              </h3>
            </div>
            <div className="mt-3 space-y-2">
              {exclusions.map((item) => (
                <p key={item} className="text-sm leading-relaxed text-text-secondary">
                  {item}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {!compact && questions.length > 0 && (
        <div className="rounded-xl border border-border bg-surface px-5 py-4">
          <div className="flex items-center gap-2">
            <CircleHelp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text-primary">
              Suggested next questions
            </h3>
          </div>
          <div className="mt-3 space-y-3">
            {questions.map((question) => (
              <div
                key={question.question_key}
                className="rounded-lg border border-border bg-bg-warm px-4 py-3"
              >
                <p className="text-sm font-medium text-text-primary">
                  {question.question_text}
                </p>
                {question.help_text && (
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    {question.help_text}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
