"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  UploadCloud,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
} from "lucide-react";
import AiEstimateSummary from "@/components/ai/AiEstimateSummary";
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
import ProjectAiEstimateSummaryTable, {
  type CalcMode,
  type CostOverride,
  type CustomLineItem,
  type ModeOverride,
  type QuantityOverride,
} from "./ProjectAiEstimateSummaryTable";

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
      | "customer_inclusion"
      | "material_calc_mode"
      | "labor_calc_mode"
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
  const loadingBannerRef = useRef<HTMLDivElement>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>(() =>
    getInitialAnswers([...clarifications, ...itemClarifications])
  );
  // Seed confirmation/exclusion state from previously saved customer_inclusion
  // values so the user's earlier decisions don't disappear on page refresh.
  const [excludedItemIds, setExcludedItemIds] = useState<Set<string>>(
    () =>
      new Set(
        scopeItems.filter((i) => i.customer_inclusion === "no").map((i) => i.id)
      )
  );
  const [confirmedItemIds, setConfirmedItemIds] = useState<Set<string>>(
    () =>
      new Set(
        scopeItems.filter((i) => i.customer_inclusion === "yes").map((i) => i.id)
      )
  );
  const [costOverrides, setCostOverrides] = useState<Record<string, CostOverride>>({});
  const [quantityOverrides, setQuantityOverrides] = useState<
    Record<string, QuantityOverride>
  >({});
  const [modeOverrides, setModeOverrides] = useState<
    Record<string, ModeOverride>
  >({});
  const [customLineItems, setCustomLineItems] = useState<CustomLineItem[]>([]);

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

  function handleCostOverride(
    itemId: string,
    field: "material" | "labor",
    value: number | null
  ) {
    setCostOverrides((prev) => ({
      ...prev,
      [itemId]: {
        material:
          field === "material"
            ? value
            : (prev[itemId]?.material ?? null),
        labor:
          field === "labor" ? value : (prev[itemId]?.labor ?? null),
      },
    }));
  }

  function handleQuantityOverride(
    itemId: string,
    qty: number,
    unit: string | null
  ) {
    setQuantityOverrides((prev) => ({
      ...prev,
      [itemId]: { qty, unit },
    }));
  }

  function handleModeOverride(
    itemId: string,
    field: "material" | "labor",
    mode: CalcMode
  ) {
    setModeOverrides((prev) => ({
      ...prev,
      [itemId]: {
        material:
          field === "material"
            ? mode
            : (prev[itemId]?.material ?? null),
        labor:
          field === "labor" ? mode : (prev[itemId]?.labor ?? null),
      },
    }));
  }

  function handleAddCustomItem(item: CustomLineItem) {
    setCustomLineItems((prev) => [...prev, item]);
  }

  function handleRemoveCustomItem(id: string) {
    setCustomLineItems((prev) => prev.filter((c) => c.id !== id));
  }

  const summaryItems = useMemo(
    () =>
      scopeItems.filter(
        (item) =>
          !excludedItemIds.has(item.id) &&
          (item.required_status === "required" ||
            item.item_key === "unified_project_package" ||
            confirmedItemIds.has(item.id))
      ),
    [scopeItems, excludedItemIds, confirmedItemIds]
  );

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
      requestAnimationFrame(() => {
        loadingBannerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });

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
          confirmedItemIds: Array.from(confirmedItemIds),
          excludedItemIds: Array.from(excludedItemIds),
          costOverrides,
          quantityOverrides,
          modeOverrides,
          customLineItems,
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

  const showLoadingState = isPending && pendingLabel;

  return (
    <section className="relative rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div ref={loadingBannerRef} className="flex flex-wrap items-start justify-between gap-4">
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

      {showLoadingState && (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 to-primary/10 px-8 py-16 text-center">
          <div className="relative">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-primary" />
          </div>
          <p className="mt-6 text-base font-semibold text-text-primary">
            {pendingLabel}
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
            Please be patient — the AI is hard at work analyzing your project
            scope. This could take a couple minutes!
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Processing
          </div>
        </div>
      )}

      {!showLoadingState && error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!showLoadingState && feedback && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {feedback}
        </div>
      )}

      {!showLoadingState && advisory && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {advisory}
        </div>
      )}

      {!showLoadingState && estimate ? (
        <div className="mt-5 space-y-5">
          <ProjectAiScopeItemsSection
            items={scopeItems}
            itemClarifications={[]}
            answers={{}}
            setSingleValue={setSingleValue}
            toggleMultiValue={toggleMultiValue}
            onToggleRequired={handleToggleRequired}
            excludedItemIds={excludedItemIds}
            confirmedItemIds={confirmedItemIds}
            onConfirmItem={handleConfirmItem}
          />

          {summaryItems.length > 0 && (
            <ProjectAiEstimateSummaryTable
              items={summaryItems}
              costOverrides={costOverrides}
              quantityOverrides={quantityOverrides}
              modeOverrides={modeOverrides}
              customLineItems={customLineItems}
              onCostOverride={handleCostOverride}
              onQuantityOverride={handleQuantityOverride}
              onModeOverride={handleModeOverride}
              onAddCustomItem={handleAddCustomItem}
              onRemoveCustomItem={handleRemoveCustomItem}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg-warm px-4 py-4">
            <p className="text-sm text-text-secondary">
              {summaryItems.length > 0
                ? "Adjust quantities and prices above, then save to update what bidders see."
                : "Confirm the items above, then save to update what bidders see."}
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
        </div>
      ) : !showLoadingState ? (
        <div className="mt-5 rounded-xl border border-border bg-bg-warm px-5 py-4 text-sm text-text-secondary">
          No AI analysis yet. Click <span className="font-semibold text-text-primary">Refresh AI Estimate</span> to generate the first scope check and baseline.
        </div>
      ) : null}
    </section>
  );
}
