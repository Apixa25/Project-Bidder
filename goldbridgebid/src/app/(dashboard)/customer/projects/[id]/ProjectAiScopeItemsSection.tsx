import { UploadCloud } from "lucide-react";
import type {
  ProjectAiItemClarification,
  ProjectAiScopeItem,
} from "@/lib/ai-scope-items";
import { getProjectAiScopeItemPricingReasoning } from "@/lib/ai-scope-items";

interface ItemClarificationRow
  extends Pick<
    ProjectAiItemClarification,
    | "id"
    | "scope_item_id"
    | "question_key"
    | "question_text"
    | "question_type"
    | "help_text"
    | "placeholder"
    | "answer_value_json"
    | "status"
  > {
  options_json: Array<{ id?: string; label?: string }>;
}

interface ProjectAiScopeItemsSectionProps {
  items: Array<
    Pick<
      ProjectAiScopeItem,
      | "id"
      | "item_label"
      | "item_category"
      | "required_status"
      | "confidence_level"
      | "description"
      | "why_it_may_apply"
      | "confidence_reason"
      | "estimated_low"
      | "estimated_high"
      | "source_method"
      | "needs_clarification"
    >
  >;
  itemClarifications: ItemClarificationRow[];
  answers: Record<string, string[]>;
  setSingleValue: (id: string, value: string) => void;
  toggleMultiValue: (id: string, optionId: string) => void;
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRange(low: number | null, high: number | null) {
  const lowLabel = formatCurrency(low);
  const highLabel = formatCurrency(high);

  if (!lowLabel || !highLabel) {
    return "Needs a stronger pricing signal";
  }

  return `${lowLabel} - ${highLabel}`;
}

function getRequiredStatusLabel(value: ProjectAiScopeItem["required_status"]) {
  switch (value) {
    case "required":
      return "Required";
    case "likely":
      return "Likely";
    case "possible":
      return "Possible";
    default:
      return "Unknown";
  }
}

function getRequiredStatusClassName(value: ProjectAiScopeItem["required_status"]) {
  switch (value) {
    case "required":
      return "border-red-200 bg-red-50 text-red-700";
    case "likely":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "possible":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getConfidenceClassName(value: ProjectAiScopeItem["confidence_level"]) {
  switch (value) {
    case "high":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getSourceMethodLabel(value: ProjectAiScopeItem["source_method"]) {
  switch (value) {
    case "historical_bids":
      return "Historical bids";
    case "ai_assembly":
      return "AI assembly";
    case "budget_signal":
      return "Budget signal";
    case "manual_review":
      return "Manual review";
    default:
      return "Insufficient signal";
  }
}

function getCategoryLabel(value: ProjectAiScopeItem["item_category"]) {
  return value.replaceAll("_", " ");
}

export default function ProjectAiScopeItemsSection({
  items,
  itemClarifications,
  answers,
  setSingleValue,
  toggleMultiValue,
}: ProjectAiScopeItemsSectionProps) {
  if (items.length === 0) {
    return null;
  }

  const clarificationCount = items.filter((item) => item.needs_clarification).length;

  return (
    <section className="rounded-xl border border-border bg-bg-warm/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Potential Scope Items
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
            This is the first Phase 2 itemized draft. It turns the current AI read
            into probable work packages so the customer can see what may still need
            pricing, clarification, or estimator review.
          </p>
        </div>
        <div className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-text-secondary">
          {clarificationCount} item{clarificationCount === 1 ? "" : "s"} still need
          clarification
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-border bg-surface p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  {item.item_label}
                </h4>
                <p className="mt-1 text-xs uppercase tracking-wide text-text-muted">
                  {getCategoryLabel(item.item_category)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getRequiredStatusClassName(item.required_status)}`}
                >
                  {getRequiredStatusLabel(item.required_status)}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getConfidenceClassName(item.confidence_level)}`}
                >
                  {item.confidence_level} confidence
                </span>
              </div>
            </div>

            {item.description && (
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                {item.description}
              </p>
            )}

            <div className="mt-4 rounded-lg border border-border bg-bg-warm px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Directional range
              </div>
              <div className="mt-1 text-sm font-semibold text-text-primary">
                {formatRange(item.estimated_low, item.estimated_high)}
              </div>
              <div className="mt-2 text-xs text-text-secondary">
                Source: {getSourceMethodLabel(item.source_method)}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                Pricing reasoning
              </div>
              <p className="mt-1 text-sm leading-relaxed text-sky-900">
                {getProjectAiScopeItemPricingReasoning(item)}
              </p>
            </div>

            {item.why_it_may_apply && (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Why it may apply
                </div>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                  {item.why_it_may_apply}
                </p>
              </div>
            )}

            {item.confidence_reason && (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Confidence note
                </div>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                  {item.confidence_reason}
                </p>
              </div>
            )}

            {itemClarifications.filter(
              (clarification) => clarification.scope_item_id === item.id
            ).length > 0 && (
              <div className="mt-4 rounded-xl border border-border bg-bg-warm px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Item clarification questions
                </div>
                <div className="mt-3 space-y-4">
                  {itemClarifications
                    .filter((clarification) => clarification.scope_item_id === item.id)
                    .map((clarification) => (
                      <div
                        key={clarification.id}
                        className="rounded-lg border border-border bg-surface px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-text-primary">
                              {clarification.question_text}
                            </p>
                            {clarification.help_text && (
                              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                                {clarification.help_text}
                              </p>
                            )}
                          </div>
                          <span className="rounded-full bg-bg-warm px-2.5 py-1 text-xs font-medium text-text-secondary">
                            {clarification.status === "answered"
                              ? "Answered"
                              : clarification.question_type === "upload_request"
                                ? "Upload needed"
                                : "Item detail needed"}
                          </span>
                        </div>

                        <div className="mt-3">
                          {clarification.question_type === "text" && (
                            <textarea
                              value={answers[clarification.id]?.[0] || ""}
                              onChange={(event) =>
                                setSingleValue(clarification.id, event.target.value)
                              }
                              rows={3}
                              placeholder={clarification.placeholder || ""}
                              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          )}

                          {clarification.question_type === "number" && (
                            <input
                              type="number"
                              value={answers[clarification.id]?.[0] || ""}
                              onChange={(event) =>
                                setSingleValue(clarification.id, event.target.value)
                              }
                              placeholder={clarification.placeholder || ""}
                              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          )}

                          {clarification.question_type === "single_select" && (
                            <select
                              value={answers[clarification.id]?.[0] || ""}
                              onChange={(event) =>
                                setSingleValue(clarification.id, event.target.value)
                              }
                              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="">Select an answer</option>
                              {clarification.options_json.map((option) => (
                                <option
                                  key={option.id || option.label}
                                  value={option.id || option.label || ""}
                                >
                                  {option.label || option.id}
                                </option>
                              ))}
                            </select>
                          )}

                          {clarification.question_type === "multi_select" && (
                            <div className="space-y-2">
                              {clarification.options_json.map((option) => {
                                const optionValue = option.id || option.label || "";
                                const isChecked =
                                  answers[clarification.id]?.includes(optionValue) || false;

                                return (
                                  <label
                                    key={optionValue}
                                    className="flex items-center gap-2 text-sm text-text-secondary"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() =>
                                        toggleMultiValue(
                                          clarification.id,
                                          optionValue
                                        )
                                      }
                                    />
                                    <span>{option.label || option.id}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {clarification.question_type === "upload_request" && (
                            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
                              <div className="flex items-start gap-2">
                                <UploadCloud className="mt-0.5 h-4 w-4 text-primary" />
                                <div>
                                  Upload the requested media from the project edit
                                  flow, then refresh the AI estimate.
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {item.needs_clarification && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                This item still needs clarification before it can behave like a
                reliable line-item estimate.
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
