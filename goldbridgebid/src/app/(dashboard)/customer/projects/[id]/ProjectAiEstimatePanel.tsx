"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  UploadCloud,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import AiEstimateSummary from "@/components/ai/AiEstimateSummary";
import ActionPendingOverlay from "@/components/loading/ActionPendingOverlay";
import type {
  ProjectAiRecommendedQuestion,
  ProjectAiTradeBreakdownItem,
  ProjectAiEstimateStatus,
  ProjectAiConfidenceLevel,
} from "@/lib/ai-estimates";
import type { ProjectAiScopeItem } from "@/lib/ai-scope-items";
import {
  refreshProjectAiEstimate,
  saveProjectAiClarificationsAndShare,
  setProjectAiEstimatePublication,
} from "../actions";
import ProjectAiScopeItemsSection from "./ProjectAiScopeItemsSection";

interface ClarificationRow {
  id: string;
  question_key: string;
  question_text: string;
  question_type:
    | "single_select"
    | "multi_select"
    | "number"
    | "text"
    | "upload_request";
  help_text: string | null;
  placeholder: string | null;
  options_json: Array<{ id?: string; label?: string }>;
  answer_value_json: unknown;
  status: "pending" | "answered" | "dismissed";
}

interface ItemClarificationRow extends ClarificationRow {
  scope_item_id: string;
}

interface ProjectAiEstimatePanelProps {
  projectId: string;
  estimate: {
    status: ProjectAiEstimateStatus;
    scope_completeness_score: number;
    confidence_level: ProjectAiConfidenceLevel;
    summary: string | null;
    baseline_low: number | null;
    baseline_high: number | null;
    assumptions_json: string[];
    exclusions_json: string[];
    missing_items_json: string[];
    recommended_questions_json: ProjectAiRecommendedQuestion[];
    trade_breakdown_json: ProjectAiTradeBreakdownItem[];
    published_to_bidders: boolean;
    stale_after_edit: boolean;
    last_analyzed_at: string;
    analysis_version?: string | null;
  } | null;
  latestRunModelName?: string | null;
  clarifications: ClarificationRow[];
  itemClarifications: ItemClarificationRow[];
  scopeItems: Array<
    Pick<
      ProjectAiScopeItem,
      | "id"
      | "item_key"
      | "item_label"
      | "item_category"
      | "required_status"
      | "confidence_level"
      | "description"
      | "why_it_may_apply"
      | "confidence_reason"
      | "estimated_low"
      | "estimated_high"
      | "labor_low"
      | "labor_high"
      | "material_low"
      | "material_high"
      | "equipment_low"
      | "equipment_high"
      | "quantity_drivers_json"
      | "evidence_signals_json"
      | "assumptions_json"
      | "exclusions_json"
      | "source_method"
      | "needs_clarification"
    >
  >;
}

function getInitialAnswers(clarifications: Array<ClarificationRow | ItemClarificationRow>) {
  const nextState: Record<string, string[]> = {};

  for (const clarification of clarifications) {
    if (clarification.question_type === "multi_select") {
      nextState[clarification.id] = Array.isArray(clarification.answer_value_json)
        ? clarification.answer_value_json.filter(
            (value): value is string => typeof value === "string"
          )
        : [];
      continue;
    }

    if (typeof clarification.answer_value_json === "string") {
      nextState[clarification.id] = [clarification.answer_value_json];
      continue;
    }

    if (typeof clarification.answer_value_json === "number") {
      nextState[clarification.id] = [String(clarification.answer_value_json)];
      continue;
    }

    nextState[clarification.id] = [""];
  }

  return nextState;
}

export default function ProjectAiEstimatePanel({
  projectId,
  estimate,
  latestRunModelName = null,
  clarifications,
  itemClarifications,
  scopeItems,
}: ProjectAiEstimatePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advisory, setAdvisory] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>(() =>
    getInitialAnswers([...clarifications, ...itemClarifications])
  );
  const [excludedItemIds, setExcludedItemIds] = useState<Set<string>>(new Set());
  const [confirmedItemIds, setConfirmedItemIds] = useState<Set<string>>(new Set());

  function handleToggleRequired(itemId: string, newStatus: "required" | "not_required") {
    if (newStatus === "not_required") {
      setExcludedItemIds((prev) => new Set(prev).add(itemId));
      setConfirmedItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    } else {
      setExcludedItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  function handleConfirmItem(itemId: string) {
    setConfirmedItemIds((prev) => new Set(prev).add(itemId));
  }

  const actionableClarifications = useMemo(
    () => clarifications.filter((item) => item.status !== "dismissed"),
    [clarifications]
  );

  const actionableItemClarifications = useMemo(
    () => itemClarifications.filter((item) => item.status !== "dismissed"),
    [itemClarifications]
  );

  function setSingleValue(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: [value] }));
  }

  function toggleMultiValue(id: string, optionId: string) {
    setAnswers((prev) => {
      const existing = prev[id] || [];
      const nextValues = existing.includes(optionId)
        ? existing.filter((value) => value !== optionId)
        : [...existing, optionId];

      return { ...prev, [id]: nextValues };
    });
  }

  function handleRefresh() {
    setError(null);
    setFeedback(null);
    setAdvisory(null);
    setPendingLabel("Refreshing AI estimate...");
    startTransition(async () => {
      const result = await refreshProjectAiEstimate(projectId);
      if (result.error) {
        setError(result.error);
        setPendingLabel(null);
        return;
      }

      setFeedback("AI estimate refreshed.");
      router.refresh();
    });
  }

  function handlePublicationToggle(nextPublished: boolean) {
    setError(null);
    setFeedback(null);
    setAdvisory(null);
    setPendingLabel(
      nextPublished
        ? "Updating bidder-facing project details..."
        : "Hiding bidder-facing AI summary..."
    );
    startTransition(async () => {
      const result = await setProjectAiEstimatePublication(
        projectId,
        nextPublished
      );
      if (result.error) {
        setError(result.error);
        setPendingLabel(null);
        return;
      }

      if (result.advisory) {
        setAdvisory(result.advisory);
      }
      setFeedback(
        nextPublished
          ? "The project update is now visible to bidders."
          : "AI baseline is hidden from bidders."
      );
      router.refresh();
    });
  }

  function handleSaveAndShare() {
    setError(null);
    setFeedback(null);
    setAdvisory(null);
    setPendingLabel("Saving answers and updating bidder view...");
    startTransition(async () => {
      const result = await saveProjectAiClarificationsAndShare(
        projectId,
        {
          projectAnswers: actionableClarifications
            .filter((clarification) => clarification.question_type !== "upload_request")
            .map((clarification) => ({
              clarificationId: clarification.id,
              answerValue:
                clarification.question_type === "multi_select"
                  ? answers[clarification.id] || []
                  : answers[clarification.id]?.[0] || "",
            })),
          itemAnswers: actionableItemClarifications
            .filter((clarification) => clarification.question_type !== "upload_request")
            .map((clarification) => ({
              clarificationId: clarification.id,
              answerValue:
                clarification.question_type === "multi_select"
                  ? answers[clarification.id] || []
                  : answers[clarification.id]?.[0] || "",
            })),
        }
      );

      if (result.error) {
        setError(result.error);
        setPendingLabel(null);
        return;
      }

      if (result.advisory) {
        setAdvisory(result.advisory);
      }
      setFeedback(
        estimate?.published_to_bidders
          ? "Answers saved and bidder-facing project details updated."
          : "Answers saved and bidder-facing project details shared."
      );
      router.refresh();
    });
  }

  return (
    <section className="relative rounded-xl border border-border bg-surface p-6 shadow-sm">
      {isPending && pendingLabel && <ActionPendingOverlay label={pendingLabel} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">
              AI Scope & Estimate Assistant
            </h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
            This follows the platform vision of clearer scopes, explicit completion
            criteria, and higher bidder confidence before pricing starts. The AI
            baseline is a planning tool, not a contractor quote.
          </p>
          {estimate?.last_analyzed_at && (
            <p className="mt-2 text-xs text-text-muted">
              Last analyzed {new Date(estimate.last_analyzed_at).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-warm disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            Refresh AI Estimate
          </button>

          {estimate &&
            (!actionableClarifications.length || estimate.published_to_bidders) && (
            <button
              type="button"
              onClick={() =>
                handlePublicationToggle(!estimate.published_to_bidders)
              }
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {estimate.published_to_bidders ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Hide From Bidders
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Share With Bidders
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {feedback && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {feedback}
        </div>
      )}

      {advisory && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {advisory}
        </div>
      )}

      {estimate ? (
        <div className="mt-5 space-y-5">
          {!estimate.published_to_bidders && (
            <div className="rounded-lg border border-border bg-bg-warm px-4 py-3 text-sm text-text-secondary">
              Bidders will not see this AI baseline or its clarification-informed assumptions until you click <span className="font-semibold text-text-primary">Share With Bidders</span>. Even after sharing, bidders only see a short planning summary, not the full internal clarification workflow.
            </div>
          )}

          <AiEstimateSummary
            status={estimate.status}
            score={estimate.scope_completeness_score}
            confidence={estimate.confidence_level}
            summary={estimate.summary || ""}
            baselineLow={estimate.baseline_low}
            baselineHigh={estimate.baseline_high}
            assumptions={estimate.assumptions_json}
            exclusions={estimate.exclusions_json}
            missingItems={estimate.missing_items_json}
            questions={estimate.recommended_questions_json}
            tradeBreakdown={estimate.trade_breakdown_json}
            modelName={latestRunModelName}
            analysisVersion={estimate.analysis_version || null}
          />

          <ProjectAiScopeItemsSection
            items={scopeItems}
            itemClarifications={actionableItemClarifications}
            answers={answers}
            setSingleValue={setSingleValue}
            toggleMultiValue={toggleMultiValue}
            onToggleRequired={handleToggleRequired}
            excludedItemIds={excludedItemIds}
            confirmedItemIds={confirmedItemIds}
            onConfirmItem={handleConfirmItem}
          />

          {estimate.published_to_bidders && (
            <div className="rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3 text-sm text-text-primary">
              Bidders can currently see the AI baseline estimate on this project.
            </div>
          )}

          {actionableClarifications.length > 0 && (
            <div className="rounded-xl border border-border bg-bg-warm px-5 py-4">
              <h3 className="text-sm font-semibold text-text-primary">
                Project-level clarification workflow
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Answering these structured questions improves scope completeness and
                helps tighten the estimate range.
              </p>

              <div className="mt-4 space-y-4">
                {actionableClarifications.map((clarification) => (
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
                      <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary">
                        {clarification.status === "answered"
                          ? "Answered"
                          : clarification.question_type === "upload_request"
                            ? "Upload needed"
                            : "Action needed"}
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
                              answers[clarification.id]?.includes(optionValue) ||
                              false;

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
                              Upload the requested media from the project edit flow,
                              then click <span className="font-semibold">Refresh AI Estimate</span>.
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

          {(actionableClarifications.length > 0 ||
            actionableItemClarifications.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg-warm px-4 py-4">
              <p className="text-sm text-text-secondary">
                Save all project-level and item-level AI answers together and
                update what bidders see. The AI can still recommend stronger
                scope details, but it will not block the bidder update.
              </p>
              <button
                type="button"
                onClick={handleSaveAndShare}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark disabled:opacity-60"
              >
                <Eye className="h-4 w-4" />
                {estimate?.published_to_bidders
                  ? "Save and Update Bidder View"
                  : "Save and Share With Bidders"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-border bg-bg-warm px-5 py-4 text-sm text-text-secondary">
          No AI analysis yet. Click <span className="font-semibold text-text-primary">Refresh AI Estimate</span> to generate the first scope check and baseline.
        </div>
      )}
    </section>
  );
}
