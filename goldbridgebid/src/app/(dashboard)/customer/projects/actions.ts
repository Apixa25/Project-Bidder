"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { TradeCategory, ProjectStatus } from "@/types/database";
import { generateAndUploadThumbnail } from "@/lib/generate-thumbnail";
import { generateAndUploadVideoPoster } from "@/lib/generate-video-poster";
import { userHasRole } from "@/lib/auth/roles";
import { isVideoFileType } from "@/lib/file-uploads";
import { validateProjectUploadFiles } from "@/lib/upload-validation";
import { createPaidEstimateCheckoutSessionForProject } from "./[id]/paid-estimates/actions";
import {
  sendProjectAwardedEmail,
  sendProjectClosedEmail,
  sendProjectDeletedEmail,
  sendProjectEditedEmail,
} from "@/lib/email";
import { TRADE_LABELS } from "@/types/database";
import {
  type ProjectAiAnalysisInput,
  type ProjectAiAnalysisResult,
  type ProjectAiRecommendedQuestion,
} from "@/lib/ai-estimates";
import {
  applyItemClarificationStateToScopeItems,
  buildProjectAiItemClarifications,
  buildProjectAiScopeItems,
} from "@/lib/ai-scope-items";
import { analyzeProjectAiHybrid } from "@/lib/ai/project-ai-hybrid";
import { enrichProjectAiFileSignals } from "@/lib/ai-upload-intelligence";
import type { ProjectAiClassifyOutput } from "@/lib/ai/project-ai-classify-schema";

interface CreateProjectResult {
  error: string | null;
  redirectUrl: string | null;
}

interface DraftProjectAiClarificationSubmission {
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
  options: Array<{ id?: string; label?: string }>;
  answer_value_json: string | string[];
  status: "pending" | "answered";
  display_order: number;
}

function getNormalizedProjectFileOrder(
  files: Array<{
    id: string;
    display_order: number | null;
    uploaded_at: string;
  }>
) {
  return [...files].sort((left, right) => {
    const leftOrder =
      typeof left.display_order === "number"
        ? left.display_order
        : Number.MAX_SAFE_INTEGER;
    const rightOrder =
      typeof right.display_order === "number"
        ? right.display_order
        : Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    if (left.uploaded_at !== right.uploaded_at) {
      return left.uploaded_at.localeCompare(right.uploaded_at);
    }

    return left.id.localeCompare(right.id);
  });
}

async function revalidateProjectMediaPaths(projectId: string) {
  revalidatePath("/customer");
  revalidatePath("/customer/projects");
  revalidatePath(`/customer/projects/${projectId}`);
  revalidatePath(`/customer/projects/${projectId}/edit`);
  revalidatePath("/bidder/projects");
  revalidatePath(`/bidder/projects/${projectId}`);
}

export async function getCostEstimates() {
  const supabase = createAdminClient();

  const { data: bids } = await supabase
    .from("bids")
    .select("trade, price");

  if (!bids || bids.length === 0) return [];

  const tradeGroups = new Map<string, number[]>();
  for (const bid of bids) {
    if (bid.price > 0) {
      const prices = tradeGroups.get(bid.trade) || [];
      prices.push(bid.price);
      tradeGroups.set(bid.trade, prices);
    }
  }

  const estimates: Array<{
    trade: string;
    label: string;
    avg: number;
    min: number;
    max: number;
    count: number;
  }> = [];

  for (const [trade, prices] of tradeGroups.entries()) {
    if (prices.length < 2) continue;
    const sorted = prices.sort((a, b) => a - b);
    const avg = sorted.reduce((s, p) => s + p, 0) / sorted.length;
    estimates.push({
      trade,
      label: TRADE_LABELS[trade as TradeCategory] || trade,
      avg: Math.round(avg),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      count: sorted.length,
    });
  }

  return estimates.sort((a, b) => b.count - a.count);
}

async function buildProjectAiInput(params: {
  project: {
    title: string;
    description: string;
    completion_criteria: string;
    trades: string[];
    expertise_level?: string | null;
    location_address: string;
    location_city: string;
    location_state: string;
    location_zip: string;
    budget_min: number | null;
    budget_max: number | null;
    desired_start_date: string | null;
    timeline: string | null;
  };
  files: Array<{
    file_name?: string | null;
    file_type?: string | null;
    file_url?: string | null;
  }>;
  clarifications: Array<{
    question_key: string;
    answer_value_json: unknown;
    status: "pending" | "answered" | "dismissed";
  }>;
}): Promise<ProjectAiAnalysisInput> {
  const { project, files, clarifications } = params;

  return {
    title: project.title,
    description: project.description,
    completionCriteria: project.completion_criteria,
    trades: project.trades,
    expertiseLevel: project.expertise_level || undefined,
    locationAddress: project.location_address,
    locationCity: project.location_city,
    locationState: project.location_state,
    locationZip: project.location_zip,
    budgetMin: project.budget_min,
    budgetMax: project.budget_max,
    desiredStartDate: project.desired_start_date,
    timeline: project.timeline,
    files: await enrichProjectAiFileSignals(files),
    clarificationAnswers: clarifications.map((item) => ({
      question_key: item.question_key,
      answer_value_json: item.answer_value_json,
      status: item.status,
    })),
  };
}

function parseDraftProjectAiClarifications(
  rawValue: FormDataEntryValue | null
): DraftProjectAiClarificationSubmission[] {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const questionType =
          typeof entry.question_type === "string" ? entry.question_type : "";
        if (
          ![
            "single_select",
            "multi_select",
            "number",
            "text",
            "upload_request",
          ].includes(questionType)
        ) {
          return null;
        }

        const questionKey =
          typeof entry.question_key === "string" ? entry.question_key.trim() : "";
        const questionText =
          typeof entry.question_text === "string"
            ? entry.question_text.trim()
            : "";

        if (!questionKey || !questionText) {
          return null;
        }

        const answerValue =
          questionType === "multi_select"
            ? Array.isArray(entry.answer_value_json)
              ? entry.answer_value_json.filter(
                  (value: unknown): value is string =>
                    typeof value === "string" && value.trim().length > 0
                )
              : []
            : typeof entry.answer_value_json === "string"
              ? entry.answer_value_json.trim()
              : "";

        const hasAnswer =
          (typeof answerValue === "string" && answerValue.length > 0) ||
          (Array.isArray(answerValue) && answerValue.length > 0);

        return {
          question_key: questionKey,
          question_text: questionText,
          question_type: questionType as DraftProjectAiClarificationSubmission["question_type"],
          help_text:
            typeof entry.help_text === "string" && entry.help_text.trim().length > 0
              ? entry.help_text.trim()
              : null,
          placeholder:
            typeof entry.placeholder === "string" &&
            entry.placeholder.trim().length > 0
              ? entry.placeholder.trim()
              : null,
          options: Array.isArray(entry.options)
            ? entry.options.filter(
                (option: unknown): option is { id?: string; label?: string } =>
                  Boolean(option) && typeof option === "object"
              )
            : [],
          answer_value_json: answerValue,
          status: hasAnswer ? "answered" : "pending",
          display_order:
            typeof entry.display_order === "number" ? entry.display_order : index,
        };
      })
      .filter(
        (entry): entry is DraftProjectAiClarificationSubmission => Boolean(entry)
      );
  } catch (error) {
    console.error("Failed to parse draft AI clarifications:", error);
    return [];
  }
}

async function syncProjectAiClarifications(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  projectId: string;
  questions: ProjectAiRecommendedQuestion[];
}) {
  const { supabase, projectId, questions } = params;

  const { data: existingClarifications } = await supabase
    .from("project_ai_clarifications")
    .select("id, question_key, answer_value_json, status, answered_at")
    .eq("project_id", projectId);

  const existingByKey = new Map(
    (existingClarifications || []).map((row) => [row.question_key, row])
  );

  if (questions.length > 0) {
    const nextRows = questions.map((question, index) => {
      const existing = existingByKey.get(question.question_key);
      const hasAnsweredValue =
        existing?.status === "answered" &&
        existing.answer_value_json !== null &&
        existing.answer_value_json !== undefined;

      return {
        project_id: projectId,
        question_key: question.question_key,
        question_text: question.question_text,
        question_type: question.question_type,
        help_text: question.help_text,
        placeholder: question.placeholder,
        options_json: question.options,
        answer_value_json: existing?.answer_value_json ?? null,
        status: hasAnsweredValue ? "answered" : "pending",
        asked_by: "ai" as const,
        display_order: index,
        answered_at: hasAnsweredValue ? existing?.answered_at : null,
      };
    });

    const { error: upsertError } = await supabase
      .from("project_ai_clarifications")
      .upsert(nextRows, { onConflict: "project_id,question_key" });

    if (upsertError) {
      console.error("AI clarification sync error:", upsertError);
    }
  }

  const activeKeys = new Set(questions.map((question) => question.question_key));
  const stalePendingIds = (existingClarifications || [])
    .filter(
      (row) => row.status === "pending" && !activeKeys.has(row.question_key)
    )
    .map((row) => row.id);

  if (stalePendingIds.length > 0) {
    const { error: dismissError } = await supabase
      .from("project_ai_clarifications")
      .update({ status: "dismissed" })
      .in("id", stalePendingIds);

    if (dismissError) {
      console.error("AI clarification dismiss error:", dismissError);
    }
  }
}

async function syncProjectAiScopeItems(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  projectId: string;
  items: ReturnType<typeof buildProjectAiScopeItems>;
}) {
  const { supabase, projectId, items } = params;

  // Wipe all existing scope items for this project so we start clean.
  // The LLM generates different item_key values each run, so upsert
  // alone would leave stale duplicates.
  // NOTE: We use the admin client here because the customer RLS policies
  // don't include a DELETE policy — the regular client silently deletes
  // 0 rows, causing duplicate-key errors on the subsequent insert.
  const admin = createAdminClient();
  const { error: deleteAllError } = await admin
    .from("project_ai_scope_items")
    .delete()
    .eq("project_id", projectId);

  if (deleteAllError) {
    console.error("AI scope item cleanup error:", deleteAllError);
  }

  if (items.length > 0) {
    const seenKeys = new Set<string>();
    const deduped = items.filter((item) => {
      if (seenKeys.has(item.item_key)) return false;
      seenKeys.add(item.item_key);
      return true;
    });

    if (deduped.length < items.length) {
      console.warn(
        `[scope-items] Deduped ${items.length - deduped.length} duplicate item_key(s) within single LLM run`
      );
    }

    const { error: insertError } = await supabase
      .from("project_ai_scope_items")
      .insert(
        deduped.map((item, index) => ({
          project_id: projectId,
          item_key: item.item_key,
          item_label: item.item_label,
          item_category: item.item_category,
          required_status: item.required_status,
          confidence_level: item.confidence_level,
          description: item.description,
          why_it_may_apply: item.why_it_may_apply,
          confidence_reason: item.confidence_reason,
          estimated_low: item.estimated_low,
          estimated_high: item.estimated_high,
          labor_low: item.labor_low,
          labor_high: item.labor_high,
          material_low: item.material_low,
          material_high: item.material_high,
          equipment_low: item.equipment_low,
          equipment_high: item.equipment_high,
          quantity_drivers_json: item.quantity_drivers_json,
          evidence_signals_json: item.evidence_signals_json,
          assumptions_json: item.assumptions_json,
          exclusions_json: item.exclusions_json,
          source_method: item.source_method,
          needs_clarification: item.needs_clarification,
          customer_inclusion: item.customer_inclusion,
          display_order: index,
        }))
      );

    if (insertError) {
      console.error("AI scope item insert error:", insertError);
    }
  }

  const { data: persistedItems, error: selectError } = await supabase
    .from("project_ai_scope_items")
    .select("id, item_key")
    .eq("project_id", projectId);

  if (selectError) {
    console.error("AI scope item readback error:", selectError);
    return [];
  }

  return persistedItems || [];
}

async function syncProjectAiItemClarifications(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  projectId: string;
  scopeItems: Array<{ id: string; item_key: string }>;
  clarifications: ReturnType<typeof buildProjectAiItemClarifications>;
}) {
  const { supabase, projectId, scopeItems, clarifications } = params;
  const scopeItemIds = scopeItems.map((item) => item.id);
  const itemIdByKey = new Map(scopeItems.map((item) => [item.item_key, item.id]));

  const { data: existingClarifications } =
    scopeItemIds.length > 0
      ? await supabase
          .from("project_ai_item_clarifications")
          .select("id, scope_item_id, question_key, status, answered_at")
          .eq("project_id", projectId)
          .in("scope_item_id", scopeItemIds)
      : { data: [] };

  const existingByCompositeKey = new Map(
    (existingClarifications || []).map((row) => [
      `${row.scope_item_id}::${row.question_key}`,
      row,
    ])
  );

  const nextRows = clarifications
    .map((clarification) => {
      const scopeItemId = itemIdByKey.get(clarification.scope_item_key);
      if (!scopeItemId) {
        return null;
      }

      const existing = existingByCompositeKey.get(
        `${scopeItemId}::${clarification.question_key}`
      );

      return {
        project_id: projectId,
        scope_item_id: scopeItemId,
        question_key: clarification.question_key,
        question_text: clarification.question_text,
        question_type: clarification.question_type,
        help_text: clarification.help_text,
        placeholder: clarification.placeholder,
        options_json: clarification.options_json,
        answer_value_json: clarification.answer_value_json,
        status: clarification.status,
        asked_by: "ai" as const,
        display_order: clarification.display_order,
        answered_at:
          clarification.status === "answered"
            ? existing?.answered_at || new Date().toISOString()
            : null,
      };
    })
    .filter(
      (
        row
      ): row is {
        project_id: string;
        scope_item_id: string;
        question_key: string;
        question_text: string;
        question_type: "single_select" | "multi_select" | "number" | "text" | "upload_request";
        help_text: string | null;
        placeholder: string | null;
        options_json: Array<Record<string, unknown>>;
        answer_value_json: unknown;
        status: "pending" | "answered" | "dismissed";
        asked_by: "ai";
        display_order: number;
        answered_at: string | null;
      } => Boolean(row)
    );

  if (nextRows.length > 0) {
    const { error: upsertError } = await supabase
      .from("project_ai_item_clarifications")
      .upsert(nextRows, { onConflict: "scope_item_id,question_key" });

    if (upsertError) {
      console.error("AI item clarification sync error:", upsertError);
    }
  }

  const activeCompositeKeys = new Set(
    nextRows.map((row) => `${row.scope_item_id}::${row.question_key}`)
  );
  const stalePendingIds = (existingClarifications || [])
    .filter(
      (row) =>
        row.status === "pending" &&
        !activeCompositeKeys.has(`${row.scope_item_id}::${row.question_key}`)
    )
    .map((row) => row.id);

  if (stalePendingIds.length > 0) {
    const { error: dismissError } = await supabase
      .from("project_ai_item_clarifications")
      .update({ status: "dismissed" })
      .in("id", stalePendingIds);

    if (dismissError) {
      console.error("AI item clarification dismiss error:", dismissError);
    }
  }
}

async function getProjectAiCombinedClarifications(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
) {
  const [{ data: projectClarifications }, { data: itemClarifications }] =
    await Promise.all([
      supabase
        .from("project_ai_clarifications")
        .select("question_key, answer_value_json, status")
        .eq("project_id", projectId),
      supabase
        .from("project_ai_item_clarifications")
        .select("question_key, answer_value_json, status")
        .eq("project_id", projectId),
    ]);

  return [
    ...((projectClarifications as Array<{
      question_key: string;
      answer_value_json: unknown;
      status: "pending" | "answered" | "dismissed";
    }>) || []),
    ...((itemClarifications as Array<{
      question_key: string;
      answer_value_json: unknown;
      status: "pending" | "answered" | "dismissed";
    }>) || []),
  ];
}

async function insertProjectAiNotification(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  projectId: string;
  projectTitle: string;
  analysis: ProjectAiAnalysisResult;
  previousStatus: string | null;
  isEditRefresh: boolean;
}) {
  const { supabase, userId, projectId, projectTitle, analysis, previousStatus, isEditRefresh } =
    params;

  let notification:
    | {
        user_id: string;
        type: string;
        title: string;
        message: string;
        link: string;
      }
    | null = null;

  if (isEditRefresh) {
    notification = {
      user_id: userId,
      type: "estimate_stale_after_edit",
      title: "AI baseline needs review",
      message: `Your AI baseline for "${projectTitle}" was marked stale after recent project edits. Review and republish it before sharing with bidders.`,
      link: `/customer/projects/${projectId}`,
    };
  } else if (analysis.status === "ready" && previousStatus !== "ready") {
    notification = {
      user_id: userId,
      type: "estimate_ready",
      title: "AI baseline estimate is ready",
      message: `Your project "${projectTitle}" now has an AI baseline estimate ready for review.`,
      link: `/customer/projects/${projectId}`,
    };
  } else if (
    analysis.status !== "ready" &&
    previousStatus !== analysis.status
  ) {
    notification = {
      user_id: userId,
      type: "estimate_clarification_needed",
      title: "AI needs more project details",
      message: `The AI assistant found follow-up items on "${projectTitle}" that would improve estimate quality.`,
      link: `/customer/projects/${projectId}`,
    };
  }

  if (!notification) {
    return;
  }

  const { error } = await supabase.from("notifications").insert(notification);
  if (error) {
    console.error("AI notification insert error:", error);
  }
}

async function runAndPersistProjectAiEstimate(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  projectId: string;
  projectTitle: string;
  input: ProjectAiAnalysisInput;
  triggerType: "create" | "edit" | "manual_refresh" | "clarification_answered";
  isEditRefresh?: boolean;
}) {
  const { supabase, userId, projectId, projectTitle, input, triggerType, isEditRefresh = false } =
    params;

  const startedAt = Date.now();
  const [benchmarks, previousEstimateResult] = await Promise.all([
    getCostEstimates(),
    supabase
      .from("project_ai_estimates")
      .select("status, published_to_bidders")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  const previousEstimate = previousEstimateResult.data;
  const analysis = await analyzeProjectAiHybrid(input, benchmarks);
  const draftScopeItems = buildProjectAiScopeItems({
    input,
    analysis,
    classification: analysis.classification,
    llmLaborHourEstimate: analysis.llm_labor_hour_estimate,
  });
  const itemClarifications = buildProjectAiItemClarifications({
    items: draftScopeItems,
    input,
  });
  const scopeItems = applyItemClarificationStateToScopeItems({
    items: draftScopeItems,
    clarifications: itemClarifications,
  });
  const effectiveStatus = isEditRefresh ? "stale" : analysis.status;
  const publishedToBidders = isEditRefresh
    ? false
    : (previousEstimate?.published_to_bidders ?? false);

  const classificationData = analysis.classification;

  const estimatePayload = {
    project_id: projectId,
    status: effectiveStatus,
    scope_completeness_score: analysis.scope_completeness_score,
    confidence_level: analysis.confidence_level,
    baseline_low: analysis.baseline_low,
    baseline_high: analysis.baseline_high,
    summary: analysis.summary,
    assumptions_json: analysis.assumptions,
    exclusions_json: analysis.exclusions,
    missing_items_json: analysis.missing_items,
    recommended_questions_json: analysis.recommended_questions,
    trade_breakdown_json: analysis.trade_breakdown,
    analysis_source_summary_json: analysis.analysis_source_summary,
    analysis_version: analysis.analysis_version,
    stale_after_edit: isEditRefresh,
    published_to_bidders: publishedToBidders,
    last_analyzed_at: new Date().toISOString(),
    project_type_key:
      classificationData?.project_classification.project_type_key ?? null,
    project_type_label:
      classificationData?.project_classification.project_type_label ?? null,
    classification_json: classificationData
      ? (classificationData as unknown as Record<string, unknown>)
      : {},
  };

  const { error: estimateError } = await supabase
    .from("project_ai_estimates")
    .upsert(estimatePayload, { onConflict: "project_id" });

  if (estimateError) {
    console.error("AI estimate upsert error:", estimateError);
  }

  await syncProjectAiClarifications({
    supabase,
    projectId,
    questions: analysis.recommended_questions,
  });

  const persistedScopeItems = await syncProjectAiScopeItems({
    supabase,
    projectId,
    items: scopeItems,
  });

  await syncProjectAiItemClarifications({
    supabase,
    projectId,
    scopeItems: persistedScopeItems,
    clarifications: itemClarifications,
  });

  const { error: runInsertError } = await supabase
    .from("project_ai_analysis_runs")
    .insert({
      project_id: projectId,
      trigger_type: triggerType,
      input_snapshot_json: input as Record<string, unknown>,
      output_snapshot_json: {
        ...analysis,
        status: effectiveStatus,
        stale_after_edit: isEditRefresh,
        published_to_bidders: publishedToBidders,
      } as Record<string, unknown>,
      model_name: analysis.model_name,
      duration_ms: Date.now() - startedAt,
      succeeded: !estimateError,
      error_message: estimateError?.message ?? null,
    });

  if (runInsertError) {
    console.error("AI analysis run insert error:", runInsertError);
  }

  await insertProjectAiNotification({
    supabase,
    userId,
    projectId,
    projectTitle,
    analysis,
    previousStatus: previousEstimate?.status ?? null,
    isEditRefresh,
  });

  revalidatePath(`/customer/projects/${projectId}`);
  revalidatePath(`/bidder/projects/${projectId}`);

  return {
    ...analysis,
    status: effectiveStatus,
    stale_after_edit: isEditRefresh,
    published_to_bidders: publishedToBidders,
  };
}

function buildAiPublicationAdvisory(
  analysis: {
    status: string;
    missing_items?: string[];
  } | null | undefined
) {
  if (!analysis) {
    return null;
  }

  const missingItems = analysis.missing_items || [];
  if (missingItems.length === 0 && analysis.status === "ready") {
    return null;
  }

  const topItems = missingItems.slice(0, 3);
  if (topItems.length > 0) {
    return `The bidder update is live, but the AI still recommends adding more detail about: ${topItems.join(", ")}.`;
  }

  return "The bidder update is live, but the AI still recommends adding more detail to strengthen the project scope.";
}

export async function analyzeProjectDraft(input: ProjectAiAnalysisInput) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to use AI Scope Check.", analysis: null };
  }

  if (!(await userHasRole(user.id, "customer"))) {
    return {
      error: "Enable customer mode to use AI Scope Check.",
      analysis: null,
    };
  }

  const enrichedInput = {
    ...input,
    files: input.files ? await enrichProjectAiFileSignals(input.files) : input.files,
  };
  const analysis = await analyzeProjectAiHybrid(enrichedInput, await getCostEstimates());

  const scopeItemDrafts = buildProjectAiScopeItems({
    input: enrichedInput,
    analysis,
    classification: analysis.classification || null,
  });

  return {
    error: null,
    analysis,
    classification: analysis.classification,
    scopeItemDrafts,
  };
}

export async function refreshProjectAiEstimate(projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };
  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to refresh AI estimates." };
  }

  const [{ data: project }, { data: files }, clarifications] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, title, description, completion_criteria, trades, expertise_level, location_address, location_city, location_state, location_zip, budget_min, budget_max, desired_start_date, timeline"
        )
        .eq("id", projectId)
        .eq("customer_id", user.id)
        .single(),
      supabase
        .from("project_files")
        .select("file_name, file_type, file_url")
        .eq("project_id", projectId),
      getProjectAiCombinedClarifications(supabase, projectId),
    ]);

  if (!project) {
    return { error: "Project not found." };
  }

  const analysis = await runAndPersistProjectAiEstimate({
    supabase,
    userId: user.id,
    projectId,
    projectTitle: project.title,
    input: await buildProjectAiInput({
      project,
      files: files || [],
      clarifications,
    }),
    triggerType: "manual_refresh",
  });

  return { error: null, analysis };
}

export async function answerProjectAiClarification(
  projectId: string,
  clarificationId: string,
  answerValue: string | string[]
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };
  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to answer AI clarifications." };
  }

  const [{ data: project }, { data: clarification }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, title, description, completion_criteria, trades, expertise_level, location_address, location_city, location_state, location_zip, budget_min, budget_max, desired_start_date, timeline"
      )
      .eq("id", projectId)
      .eq("customer_id", user.id)
      .single(),
    supabase
      .from("project_ai_clarifications")
      .select("id, question_type")
      .eq("id", clarificationId)
      .eq("project_id", projectId)
      .single(),
  ]);

  if (!project || !clarification) {
    return { error: "Clarification question not found." };
  }

  const normalizedAnswer =
    clarification.question_type === "multi_select"
      ? Array.isArray(answerValue)
        ? answerValue
        : [answerValue].filter(Boolean)
      : Array.isArray(answerValue)
        ? answerValue.join(", ")
        : answerValue;

  if (
    (typeof normalizedAnswer === "string" && normalizedAnswer.trim().length === 0) ||
    (Array.isArray(normalizedAnswer) && normalizedAnswer.length === 0)
  ) {
    return { error: "Please enter an answer before saving." };
  }

  const { error: updateError } = await supabase
    .from("project_ai_clarifications")
    .update({
      answer_value_json: normalizedAnswer,
      status: "answered",
      answered_at: new Date().toISOString(),
    })
    .eq("id", clarificationId)
    .eq("project_id", projectId);

  if (updateError) {
    console.error("AI clarification answer error:", updateError);
    return { error: "Failed to save your clarification answer." };
  }

  const [{ data: files }, clarifications] = await Promise.all([
    supabase
      .from("project_files")
      .select("file_name, file_type, file_url")
      .eq("project_id", projectId),
    getProjectAiCombinedClarifications(supabase, projectId),
  ]);

  const analysis = await runAndPersistProjectAiEstimate({
    supabase,
    userId: user.id,
    projectId,
    projectTitle: project.title,
    input: await buildProjectAiInput({
      project,
      files: files || [],
      clarifications,
    }),
    triggerType: "clarification_answered",
  });

  return { error: null, analysis };
}

export async function saveProjectAiClarificationsAndShare(
  projectId: string,
  answers: {
    projectAnswers: Array<{
      clarificationId: string;
      answerValue: string | string[];
    }>;
    itemAnswers: Array<{
      clarificationId: string;
      answerValue: string | string[];
    }>;
    confirmedItemIds?: string[];
    excludedItemIds?: string[];
    costOverrides?: Record<string, { material: number | null; labor: number | null }>;
    quantityOverrides?: Record<string, { qty: number; unit: string | null }>;
    modeOverrides?: Record<
      string,
      { material: "multiply" | "add" | null; labor: "multiply" | "add" | null }
    >;
    customLineItems?: Array<{
      id: string;
      label: string;
      unit: string;
      qty: number;
      material: number;
      labor: number;
    }>;
  }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };
  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to update AI clarifications." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, title, description, completion_criteria, trades, expertise_level, location_address, location_city, location_state, location_zip, budget_min, budget_max, desired_start_date, timeline, customer_id"
    )
    .eq("id", projectId)
    .eq("customer_id", user.id)
    .single();

  if (!project) {
    return { error: "Project not found." };
  }

  for (const entry of answers.projectAnswers) {
    const { data: clarification } = await supabase
      .from("project_ai_clarifications")
      .select("id, question_type")
      .eq("id", entry.clarificationId)
      .eq("project_id", projectId)
      .single();

    if (!clarification) {
      continue;
    }

    const normalizedAnswer =
      clarification.question_type === "multi_select"
        ? Array.isArray(entry.answerValue)
          ? entry.answerValue.filter(Boolean)
          : [entry.answerValue].filter(Boolean)
        : Array.isArray(entry.answerValue)
          ? entry.answerValue.join(", ")
          : entry.answerValue;

    const hasAnswer =
      (typeof normalizedAnswer === "string" && normalizedAnswer.trim().length > 0) ||
      (Array.isArray(normalizedAnswer) && normalizedAnswer.length > 0);

    if (!hasAnswer) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("project_ai_clarifications")
      .update({
        answer_value_json: normalizedAnswer,
        status: "answered",
        answered_at: new Date().toISOString(),
      })
      .eq("id", clarification.id)
      .eq("project_id", projectId);

    if (updateError) {
      console.error("Bulk AI clarification answer error:", updateError);
      return { error: "Failed to save one of the clarification answers." };
    }
  }

  for (const entry of answers.itemAnswers) {
    const { data: clarification } = await supabase
      .from("project_ai_item_clarifications")
      .select("id, question_type")
      .eq("id", entry.clarificationId)
      .eq("project_id", projectId)
      .single();

    if (!clarification) {
      continue;
    }

    const normalizedAnswer =
      clarification.question_type === "multi_select"
        ? Array.isArray(entry.answerValue)
          ? entry.answerValue.filter(Boolean)
          : [entry.answerValue].filter(Boolean)
        : Array.isArray(entry.answerValue)
          ? entry.answerValue.join(", ")
          : entry.answerValue;

    const hasAnswer =
      (typeof normalizedAnswer === "string" && normalizedAnswer.trim().length > 0) ||
      (Array.isArray(normalizedAnswer) && normalizedAnswer.length > 0);

    if (!hasAnswer) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("project_ai_item_clarifications")
      .update({
        answer_value_json: normalizedAnswer,
        status: "answered",
        answered_at: new Date().toISOString(),
      })
      .eq("id", clarification.id)
      .eq("project_id", projectId);

    if (updateError) {
      console.error("Bulk AI item clarification answer error:", updateError);
      return { error: "Failed to save one of the item clarification answers." };
    }
  }

  // Persist confirmed/excluded scope items
  if (answers.confirmedItemIds && answers.confirmedItemIds.length > 0) {
    const { error: confirmError } = await supabase
      .from("project_ai_scope_items")
      .update({ customer_inclusion: "yes" })
      .eq("project_id", projectId)
      .in("id", answers.confirmedItemIds);

    if (confirmError) {
      console.error("Confirm scope items error:", confirmError);
    }
  }

  if (answers.excludedItemIds && answers.excludedItemIds.length > 0) {
    const { error: excludeError } = await supabase
      .from("project_ai_scope_items")
      .update({ customer_inclusion: "no" })
      .eq("project_id", projectId)
      .in("id", answers.excludedItemIds);

    if (excludeError) {
      console.error("Exclude scope items error:", excludeError);
    }
  }

  // Apply user quantity overrides — store in quantity_drivers_json as
  // a customer_stated_quantity entry so the existing pricing pipeline
  // and summary table can read it back consistently.
  if (answers.quantityOverrides) {
    for (const [itemId, override] of Object.entries(answers.quantityOverrides)) {
      if (!override || !Number.isFinite(override.qty) || override.qty <= 0) {
        continue;
      }

      const { data: existingItem } = await supabase
        .from("project_ai_scope_items")
        .select("quantity_drivers_json")
        .eq("id", itemId)
        .eq("project_id", projectId)
        .maybeSingle();

      const drivers = Array.isArray(existingItem?.quantity_drivers_json)
        ? (existingItem.quantity_drivers_json as Array<{
            key: string;
            label?: string;
            value: string;
            unit: string | null;
            confidence?: string;
            source?: string;
          }>)
        : [];

      const filteredDrivers = drivers.filter(
        (d) => d.key !== "customer_stated_quantity"
      );

      filteredDrivers.unshift({
        key: "customer_stated_quantity",
        label: "Customer-stated quantity",
        value: String(override.qty),
        unit: override.unit || null,
        confidence: "high",
        source: "customer_input",
      });

      const { error: qtyError } = await supabase
        .from("project_ai_scope_items")
        .update({ quantity_drivers_json: filteredDrivers })
        .eq("id", itemId)
        .eq("project_id", projectId);

      if (qtyError) {
        console.error("Quantity override error for item:", itemId, qtyError);
      }
    }
  }

  // Apply user cost overrides to scope items
  if (answers.costOverrides) {
    for (const [itemId, override] of Object.entries(answers.costOverrides)) {
      const updates: Record<string, number | null> = {};
      if (override.material !== null) {
        updates.material_low = override.material;
        updates.material_high = override.material;
      }
      if (override.labor !== null) {
        updates.labor_low = override.labor;
        updates.labor_high = override.labor;
      }
      if (Object.keys(updates).length > 0) {
        const totalLow = (updates.material_low ?? 0) + (updates.labor_low ?? 0);
        const totalHigh = (updates.material_high ?? 0) + (updates.labor_high ?? 0);
        if (totalLow > 0 || totalHigh > 0) {
          updates.estimated_low = totalLow;
          updates.estimated_high = totalHigh;
        }
        const { error: overrideError } = await supabase
          .from("project_ai_scope_items")
          .update(updates)
          .eq("id", itemId)
          .eq("project_id", projectId);

        if (overrideError) {
          console.error("Cost override error for item:", itemId, overrideError);
        }
      }
    }
  }

  // Apply user calc-mode overrides (per-unit "multiply" vs flat "add")
  // for material and labor on each scope item.
  if (answers.modeOverrides) {
    for (const [itemId, override] of Object.entries(answers.modeOverrides)) {
      const updates: Record<string, string> = {};
      if (override.material === "multiply" || override.material === "add") {
        updates.material_calc_mode = override.material;
      }
      if (override.labor === "multiply" || override.labor === "add") {
        updates.labor_calc_mode = override.labor;
      }
      if (Object.keys(updates).length > 0) {
        const { error: modeError } = await supabase
          .from("project_ai_scope_items")
          .update(updates)
          .eq("id", itemId)
          .eq("project_id", projectId);

        if (modeError) {
          console.error("Calc mode override error for item:", itemId, modeError);
        }
      }
    }
  }

  // Persist custom line items as new scope items
  if (answers.customLineItems && answers.customLineItems.length > 0) {
    for (const custom of answers.customLineItems) {
      const materialTotal = custom.material * custom.qty;
      const laborTotal = custom.labor * custom.qty;
      const { error: insertError } = await supabase
        .from("project_ai_scope_items")
        .upsert(
          {
            project_id: projectId,
            item_key: custom.id,
            item_label: custom.label,
            item_category: "other",
            required_status: "required",
            confidence_level: "high",
            description: `Custom line item added by customer. ${custom.qty} ${custom.unit}.`,
            source_method: "manual_review",
            customer_inclusion: "yes",
            material_low: materialTotal,
            material_high: materialTotal,
            labor_low: laborTotal,
            labor_high: laborTotal,
            estimated_low: materialTotal + laborTotal,
            estimated_high: materialTotal + laborTotal,
            needs_clarification: false,
            display_order: 9999,
          },
          { onConflict: "project_id,item_key" }
        );

      if (insertError) {
        console.error("Custom line item insert error:", insertError);
      }
    }
  }

  // IMPORTANT: We deliberately do NOT re-run runAndPersistProjectAiEstimate here.
  // That function wipes all scope items and re-runs the LLM, which would destroy
  // every confirmation, exclusion, cost override, quantity override, and custom
  // line item the user just saved. The user has finalized their decisions —
  // just publish the current state to bidders.
  const { error: publishError } = await supabase
    .from("project_ai_estimates")
    .update({
      published_to_bidders: true,
      stale_after_edit: false,
    })
    .eq("project_id", projectId);

  if (publishError) {
    console.error("AI publish after clarification error:", publishError);
    return { error: "Clarifications were saved, but the bidder update could not be published." };
  }

  revalidatePath(`/customer/projects/${projectId}`);
  revalidatePath(`/bidder/projects/${projectId}`);

  return {
    error: null,
    success: true,
    advisory: null as string | null,
  };
}

export async function setProjectAiEstimatePublication(
  projectId: string,
  published: boolean
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };
  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to manage AI baseline visibility." };
  }

  const { data: estimate } = await supabase
    .from("project_ai_estimates")
    .select("id, status")
    .eq("project_id", projectId)
    .single();

  if (!estimate) {
    return { error: "Run the AI analysis before sharing it with bidders." };
  }

  let advisory: string | null = null;

  if (published) {
    const [{ data: project }, { data: files }, clarifications] =
      await Promise.all([
        supabase
          .from("projects")
          .select(
            "id, title, description, completion_criteria, trades, expertise_level, location_address, location_city, location_state, location_zip, budget_min, budget_max, desired_start_date, timeline"
          )
          .eq("id", projectId)
          .eq("customer_id", user.id)
          .single(),
        supabase
          .from("project_files")
          .select("file_name, file_type, file_url")
          .eq("project_id", projectId),
        getProjectAiCombinedClarifications(supabase, projectId),
      ]);

    if (!project) {
      return { error: "Project not found." };
    }

    const refreshedAnalysis = await runAndPersistProjectAiEstimate({
      supabase,
      userId: user.id,
      projectId,
      projectTitle: project.title,
      input: await buildProjectAiInput({
        project,
        files: files || [],
        clarifications,
      }),
      triggerType: "manual_refresh",
    });

    advisory = buildAiPublicationAdvisory(refreshedAnalysis);
  }

  const { error } = await supabase
    .from("project_ai_estimates")
    .update({
      published_to_bidders: published,
      stale_after_edit: false,
    })
    .eq("project_id", projectId);

  if (error) {
    console.error("AI estimate publication error:", error);
    return { error: "Failed to update AI baseline visibility." };
  }

  revalidatePath(`/customer/projects/${projectId}`);
  revalidatePath(`/bidder/projects/${projectId}`);
  return { error: null, success: true, advisory };
}

export async function createProject(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "You must be logged in to create a project.",
      redirectUrl: null,
    } satisfies CreateProjectResult;
  }

  if (!(await userHasRole(user.id, "customer"))) {
    return {
      error: "Enable customer mode to post and manage projects.",
      redirectUrl: null,
    } satisfies CreateProjectResult;
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const completionCriteria = (formData.get("completionCriteria") as string) || "";
  const expertiseLevelRaw = (formData.get("expertiseLevel") as string) || "";
  const locationAddress = formData.get("locationAddress") as string;
  const locationCity = formData.get("locationCity") as string;
  const locationState = formData.get("locationState") as string;
  const locationZip = formData.get("locationZip") as string;
  const budgetMin = formData.get("budgetMin") as string;
  const budgetMax = formData.get("budgetMax") as string;
  const desiredStartDate = formData.get("desiredStartDate") as string;
  const timeline = formData.get("timeline") as string;
  const draftAiClarifications = parseDraftProjectAiClarifications(
    formData.get("draftAiClarifications")
  );

  const expertiseLevel = (["licensed_contractor", "handyman", "general_labor"].includes(expertiseLevelRaw)
    ? expertiseLevelRaw
    : null) as string | null;

  const trades = expertiseLevel === "licensed_contractor"
    ? ["general_b" as TradeCategory]
    : expertiseLevel === "handyman"
    ? ["handyman" as TradeCategory]
    : expertiseLevel === "general_labor"
    ? ["general_work" as TradeCategory]
    : ([] as TradeCategory[]);

  console.info("createProject: received submit", {
    userId: user.id,
    hasTitle: Boolean(title),
    hasDescription: Boolean(description),
    expertiseLevel,
    hasLocationAddress: Boolean(locationAddress),
    hasLocationCity: Boolean(locationCity),
    hasLocationState: Boolean(locationState),
    hasLocationZip: Boolean(locationZip),
    enablePaidEstimate: formData.get("enablePaidEstimate") === "true",
    rewardAmount: formData.get("rewardAmount"),
    maxPaidSlots: formData.get("maxPaidSlots"),
    filter: formData.get("filter"),
    fileCount: formData.getAll("files").filter((file) => file instanceof File && file.size > 0).length,
    draftAiClarificationCount: draftAiClarifications.length,
  });

  if (
    !title ||
    !description ||
    !locationAddress ||
    !locationCity ||
    !locationState ||
    !locationZip
  ) {
    return {
      error: "Please fill in all required fields.",
      redirectUrl: null,
    } satisfies CreateProjectResult;
  }

  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => f.size > 0);
  const validationError = validateProjectUploadFiles(validFiles);
  if (validationError) {
    return {
      error: validationError,
      redirectUrl: null,
    } satisfies CreateProjectResult;
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      customer_id: user.id,
      title,
      description,
      completion_criteria: completionCriteria,
      trades,
      expertise_level: expertiseLevel,
      location_address: locationAddress,
      location_city: locationCity,
      location_state: locationState,
      location_zip: locationZip,
      budget_min: budgetMin ? parseFloat(budgetMin) : null,
      budget_max: budgetMax ? parseFloat(budgetMax) : null,
      desired_start_date: desiredStartDate || null,
      timeline: timeline || null,
    })
    .select("id")
    .single();

  if (projectError) {
    console.error("Project creation error:", {
      code: projectError.code,
      message: projectError.message,
      details: projectError.details,
      hint: projectError.hint,
    });
    return {
      error: "Failed to create project. Please try again.",
      redirectUrl: null,
    } satisfies CreateProjectResult;
  }

  console.info("createProject: project created", {
    userId: user.id,
    projectId: project.id,
    enablePaidEstimate: formData.get("enablePaidEstimate") === "true",
  });

  if (project && draftAiClarifications.length > 0) {
    const { error: draftClarificationError } = await supabase
      .from("project_ai_clarifications")
      .upsert(
        draftAiClarifications.map((clarification, index) => ({
          project_id: project.id,
          question_key: clarification.question_key,
          question_text: clarification.question_text,
          question_type: clarification.question_type,
          help_text: clarification.help_text,
          placeholder: clarification.placeholder,
          options_json: clarification.options,
          answer_value_json:
            clarification.status === "answered"
              ? clarification.answer_value_json
              : null,
          status: clarification.status,
          asked_by: "ai" as const,
          display_order:
            typeof clarification.display_order === "number"
              ? clarification.display_order
              : index,
          answered_at:
            clarification.status === "answered"
              ? new Date().toISOString()
              : null,
        })),
        { onConflict: "project_id,question_key" }
      );

    if (draftClarificationError) {
      console.error(
        "Draft AI clarification seed error:",
        draftClarificationError
      );
    }
  }

  // Handle file uploads
  if (validFiles.length > 0 && project) {
    let nextDisplayOrder = 0;
    for (const file of validFiles) {
      try {
        const fileExt = file.name.split(".").pop();
        const filePath = `projects/${project.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("project-files")
          .upload(filePath, file, { contentType: file.type || undefined });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("project-files").getPublicUrl(filePath);

        let thumbnailUrl: string | null = null;
        if (file.type.startsWith("image/")) {
          thumbnailUrl = await generateAndUploadThumbnail(
            file,
            "project-files",
            filePath
          );
        } else if (isVideoFileType(file.type)) {
          thumbnailUrl = await generateAndUploadVideoPoster(
            file,
            "project-files",
            filePath
          );
        }

        const insertData: Record<string, unknown> = {
          project_id: project.id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          display_order: nextDisplayOrder,
        };
        if (thumbnailUrl) {
          insertData.thumbnail_url = thumbnailUrl;
        }

        const { error: insertError } = await supabase
          .from("project_files")
          .insert(insertData);

        if (insertError) {
          console.error("project_files insert error:", insertError);
        }

        nextDisplayOrder += 1;
      } catch (err) {
        console.error("File processing error:", err);
      }
    }
  }

  await runAndPersistProjectAiEstimate({
    supabase,
    userId: user.id,
    projectId: project.id,
    projectTitle: title,
    input: {
      title,
      description,
      completionCriteria,
      trades,
      expertiseLevel: expertiseLevel || undefined,
      locationAddress,
      locationCity,
      locationState,
      locationZip,
      budgetMin: budgetMin ? parseFloat(budgetMin) : null,
      budgetMax: budgetMax ? parseFloat(budgetMax) : null,
      desiredStartDate: desiredStartDate || null,
      timeline: timeline || null,
      files: await enrichProjectAiFileSignals(
        validFiles.map((file) => ({
          file_name: file.name,
          file_type: file.type,
          file_url: null,
        }))
      ),
      clarificationAnswers: draftAiClarifications.map((clarification) => ({
        question_key: clarification.question_key,
        answer_value_json:
          clarification.status === "answered"
            ? clarification.answer_value_json
            : null,
        status: clarification.status,
      })),
    },
    triggerType: "create",
  });

  const shouldCreatePaidEstimate =
    formData.get("enablePaidEstimate") === "true";

  if (shouldCreatePaidEstimate) {
    console.info("createProject: preparing paid estimate checkout", {
      userId: user.id,
      projectId: project.id,
      rewardAmount: formData.get("rewardAmount"),
      maxPaidSlots: formData.get("maxPaidSlots"),
      filter: formData.get("filter"),
    });

    const paidEstimateResult = await createPaidEstimateCheckoutSessionForProject({
      customerId: user.id,
      projectId: project.id,
      rewardAmountRaw: (formData.get("rewardAmount") as string) || "",
      maxPaidSlotsRaw: (formData.get("maxPaidSlots") as string) || "",
      filterValue: formData.get("filter"),
    });

    if (paidEstimateResult.checkoutUrl) {
      console.info("createProject: paid estimate checkout created", {
        userId: user.id,
        projectId: project.id,
      });
      return {
        error: null,
        redirectUrl: paidEstimateResult.checkoutUrl,
      } satisfies CreateProjectResult;
    }

    console.error("createProject: paid estimate checkout preparation failed", {
      userId: user.id,
      projectId: project.id,
      error: paidEstimateResult.error,
    });

    return {
      error:
        paidEstimateResult.error ||
        "Project was created, but paid estimate checkout could not be prepared.",
      redirectUrl: `/customer/projects/${project.id}?paidEstimateSetup=failed`,
    } satisfies CreateProjectResult;
  }

  return {
    error: null,
    redirectUrl: `/customer/projects/${project.id}`,
  } satisfies CreateProjectResult;
}

export async function updateProjectStatus(projectId: string, status: "open" | "closed") {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to manage projects." };
  }

  const { error } = await supabase
    .from("projects")
    .update({
      status,
      ...(status === "closed"
        ? {}
        : {
            awarded_bid_id: null,
            awarded_bidder_id: null,
            awarded_at: null,
          }),
    })
    .eq("id", projectId)
    .eq("customer_id", user.id);

  if (error) {
    return { error: "Failed to update project status." };
  }

  if (status === "closed") {
    const { data: projectInfo } = await supabase
      .from("projects")
      .select("title")
      .eq("id", projectId)
      .single();

    const { data: bids } = await supabase
      .from("bids")
      .select("bidder_id")
      .eq("project_id", projectId);

    if (bids) {
      const notifications = bids.map((bid) => ({
        user_id: bid.bidder_id,
        type: "project_closed",
        title: "Project has been closed",
        message: "A project you bid on has been closed.",
        link: `/bidder/bids`,
      }));

      await supabase.from("notifications").insert(notifications);

      const bidderIds = [...new Set(bids.map((b) => b.bidder_id))];
      const { data: bidderProfiles } = await supabase
        .from("profiles")
        .select("user_id, email")
        .in("user_id", bidderIds);

      for (const bp of bidderProfiles || []) {
        if (bp.email) {
          sendProjectClosedEmail(bp.email, projectInfo?.title || "Untitled");
        }
      }
    }
  }

  return { success: true };
}

export async function awardBid(projectId: string, bidId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to award projects." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, status, customer_id, awarded_bid_id")
    .eq("id", projectId)
    .eq("customer_id", user.id)
    .single();

  if (!project) {
    return { error: "Project not found." };
  }

  if (project.status !== "open") {
    return { error: "Only open projects can be awarded." };
  }

  if (project.awarded_bid_id) {
    return { error: "This project already has a winning bid." };
  }

  const { data: bid } = await supabase
    .from("bids")
    .select("id, bidder_id")
    .eq("id", bidId)
    .eq("project_id", projectId)
    .single();

  if (!bid) {
    return { error: "Winning bid not found." };
  }

  const awardedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      status: "awarded",
      awarded_bid_id: bid.id,
      awarded_bidder_id: bid.bidder_id,
      awarded_at: awardedAt,
    })
    .eq("id", projectId)
    .eq("customer_id", user.id)
    .eq("status", "open");

  if (updateError) {
    console.error("Award bid error:", updateError);
    return { error: "Failed to award this bid. Please try again." };
  }

  const { data: allBids } = await supabase
    .from("bids")
    .select("bidder_id")
    .eq("project_id", projectId);

  if (allBids && allBids.length > 0) {
    const notifications = allBids.map((projectBid) => {
      const isWinner = projectBid.bidder_id === bid.bidder_id;

      return {
        user_id: projectBid.bidder_id,
        type: "project_awarded",
        title: isWinner ? "Your bid was awarded" : "Project has been awarded",
        message: isWinner
          ? `Congratulations! Your bid for "${project.title}" was selected.`
          : `The project "${project.title}" has been awarded to another contractor.`,
        link: `/bidder/bids`,
      };
    });

    await supabase.from("notifications").insert(notifications);

    const bidderIds = [...new Set(allBids.map((b) => b.bidder_id))];
    const { data: bidderProfiles } = await supabase
      .from("profiles")
      .select("user_id, email")
      .in("user_id", bidderIds);

    for (const bp of bidderProfiles || []) {
      if (bp.email) {
        const isWinner = bp.user_id === bid.bidder_id;
        sendProjectAwardedEmail(bp.email, project.title, isWinner);
      }
    }
  }

  return { success: true };
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to manage projects." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, customer_id, title")
    .eq("id", projectId)
    .eq("customer_id", user.id)
    .single();

  if (!project) return { error: "Project not found." };

  // Notify existing bidders before deleting
  const { data: bids } = await supabase
    .from("bids")
    .select("bidder_id")
    .eq("project_id", projectId);

  if (bids && bids.length > 0) {
    const notifications = bids.map((bid) => ({
      user_id: bid.bidder_id,
      type: "project_closed",
      title: "Project has been deleted",
      message: `The project "${project.title}" you bid on has been deleted by the customer.`,
      link: `/bidder/bids`,
    }));
    await supabase.from("notifications").insert(notifications);

    const bidderIds = [...new Set(bids.map((b) => b.bidder_id))];
    const { data: bidderProfiles } = await supabase
      .from("profiles")
      .select("user_id, email")
      .in("user_id", bidderIds);

    for (const bp of bidderProfiles || []) {
      if (bp.email) {
        sendProjectDeletedEmail(bp.email, project.title);
      }
    }
  }

  // Delete stored files from Supabase Storage
  const { data: projectFiles } = await supabase
    .from("project_files")
    .select("file_url")
    .eq("project_id", projectId);

  if (projectFiles && projectFiles.length > 0) {
    const storagePaths = projectFiles
      .map((f) => {
        const match = f.file_url.match(/project-files\/(.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];

    if (storagePaths.length > 0) {
      await supabase.storage.from("project-files").remove(storagePaths);
    }
  }

  // CASCADE handles project_files, project_edits, bids, bid_files, messages
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("customer_id", user.id);

  if (error) {
    console.error("Delete project error:", error);
    return { error: "Failed to delete project. Please try again." };
  }

  revalidatePath("/customer/projects");
  return { success: true };
}

export async function markProjectCompleted(projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to manage projects." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, status, customer_id, awarded_bidder_id")
    .eq("id", projectId)
    .eq("customer_id", user.id)
    .single();

  if (!project) return { error: "Project not found." };

  if (project.status !== "awarded") {
    return { error: "Only awarded projects can be marked as completed." };
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update({ status: "completed" as ProjectStatus })
    .eq("id", projectId)
    .eq("customer_id", user.id);

  if (updateError) {
    console.error("Mark project completed error:", updateError);
    return { error: "Failed to mark project as completed." };
  }

  const notifications: Array<{
    user_id: string;
    type: string;
    title: string;
    message: string;
    link: string;
  }> = [];

  notifications.push({
    user_id: user.id,
    type: "review_prompt",
    title: "Leave a review for the contractor",
    message: `"${project.title}" is marked complete. Share your experience — your review helps other customers!`,
    link: `/profile/${project.awarded_bidder_id}`,
  });

  if (project.awarded_bidder_id) {
    notifications.push({
      user_id: project.awarded_bidder_id,
      type: "project_completed",
      title: "Project marked complete!",
      message: `The customer marked "${project.title}" as complete. Great work!`,
      link: `/bidder/bids`,
    });

    notifications.push({
      user_id: project.awarded_bidder_id,
      type: "review_prompt",
      title: "Leave a review for the customer",
      message: `"${project.title}" is complete. Share your experience working with this customer!`,
      link: `/profile/${user.id}`,
    });
  }

  await supabase.from("notifications").insert(notifications);

  revalidatePath(`/customer/projects/${projectId}`);
  revalidatePath("/customer/projects");
  revalidatePath("/customer");

  return { success: true };
}

export async function saveAnnotation(projectFileId: string, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to annotate project files." };
  }

  const blob = formData.get("annotatedImage") as File;
  if (!blob || blob.size === 0) return { error: "No annotated image provided." };

  // Verify ownership: the project_file must belong to a project owned by this user
  const { data: projectFile } = await supabase
    .from("project_files")
    .select("id, project_id")
    .eq("id", projectFileId)
    .single();

  if (!projectFile) return { error: "File not found." };

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectFile.project_id)
    .eq("customer_id", user.id)
    .single();

  if (!project) return { error: "Not authorized to annotate this file." };

  const filePath = `projects/${project.id}/annotated/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

  const { error: uploadError } = await supabase.storage
    .from("project-files")
    .upload(filePath, blob, { contentType: "image/png" });

  if (uploadError) {
    console.error("Annotation upload error:", uploadError);
    return { error: "Failed to upload annotated image." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("project-files").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("project_files")
    .update({ annotated_url: publicUrl })
    .eq("id", projectFileId);

  if (updateError) {
    console.error("Annotation update error:", updateError);
    return { error: "Failed to save annotation." };
  }

  return { success: true, annotatedUrl: publicUrl };
}

export async function setFeaturedProjectFile(projectFileId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to manage project media." };
  }

  const { data: selectedFile } = await supabase
    .from("project_files")
    .select("id, project_id, file_type")
    .eq("id", projectFileId)
    .single();

  if (!selectedFile) {
    return { error: "Project file not found." };
  }

  if (!selectedFile.file_type.startsWith("image/") && !isVideoFileType(selectedFile.file_type)) {
    return { error: "Only photos and videos can be featured on project cards." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", selectedFile.project_id)
    .eq("customer_id", user.id)
    .single();

  if (!project) {
    return { error: "Not authorized to manage this project file." };
  }

  const { data: projectFiles } = await supabase
    .from("project_files")
    .select("id, display_order, uploaded_at")
    .eq("project_id", selectedFile.project_id);

  const orderedFiles = getNormalizedProjectFileOrder(projectFiles || []);
  const nextOrderedIds = [
    projectFileId,
    ...orderedFiles.filter((file) => file.id !== projectFileId).map((file) => file.id),
  ];

  for (const [index, fileId] of nextOrderedIds.entries()) {
    const { error: updateError } = await supabase
      .from("project_files")
      .update({ display_order: index })
      .eq("id", fileId)
      .eq("project_id", selectedFile.project_id);

    if (updateError) {
      console.error("Project file reorder error:", updateError);
      return { error: "Failed to update featured project media." };
    }
  }

  await revalidateProjectMediaPaths(selectedFile.project_id);

  return {
    success: true,
    orderedIds: nextOrderedIds,
    projectId: selectedFile.project_id,
  };
}

export async function updateProject(projectId: string, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to update projects." };
  }

  // Fetch current project to compare changes
  const { data: current } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("customer_id", user.id)
    .single();

  if (!current) return { error: "Project not found." };

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const completionCriteria = (formData.get("completionCriteria") as string) || "";
  const expertiseLevelRaw = (formData.get("expertiseLevel") as string) || "";
  const locationAddress = formData.get("locationAddress") as string;
  const locationCity = formData.get("locationCity") as string;
  const locationState = formData.get("locationState") as string;
  const locationZip = formData.get("locationZip") as string;
  const budgetMin = formData.get("budgetMin") as string;
  const budgetMax = formData.get("budgetMax") as string;
  const desiredStartDate = formData.get("desiredStartDate") as string;
  const timeline = formData.get("timeline") as string;

  const expertiseLevel = (["licensed_contractor", "handyman", "general_labor"].includes(expertiseLevelRaw)
    ? expertiseLevelRaw
    : null) as string | null;

  const trades = expertiseLevel === "licensed_contractor"
    ? ["general_b" as TradeCategory]
    : expertiseLevel === "handyman"
    ? ["handyman" as TradeCategory]
    : expertiseLevel === "general_labor"
    ? ["general_work" as TradeCategory]
    : ([] as TradeCategory[]);

  if (
    !title ||
    !description ||
    !locationAddress ||
    !locationCity ||
    !locationState ||
    !locationZip
  ) {
    return { error: "Please fill in all required fields." };
  }

  const { data: existingProjectFiles } = await supabase
    .from("project_files")
    .select("id, file_name, file_type, file_url, display_order, uploaded_at")
    .eq("project_id", projectId);

  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => f.size > 0);
  const existingVideoCount =
    (existingProjectFiles || []).filter((file) => isVideoFileType(file.file_type))
      .length || 0;
  const uploadValidationError = validateProjectUploadFiles(
    validFiles,
    existingVideoCount
  );
  if (uploadValidationError) {
    return { error: uploadValidationError };
  }

  const edits: { field_name: string; old_value: string; new_value: string }[] = [];

  const fieldChecks: { field: string; oldVal: string; newVal: string }[] = [
    { field: "title", oldVal: current.title, newVal: title },
    { field: "description", oldVal: current.description, newVal: description },
    { field: "completion_criteria", oldVal: current.completion_criteria, newVal: completionCriteria },
    { field: "expertise_level", oldVal: current.expertise_level || "", newVal: expertiseLevel || "" },
    { field: "location_address", oldVal: current.location_address, newVal: locationAddress },
    { field: "location_city", oldVal: current.location_city, newVal: locationCity },
    { field: "location_state", oldVal: current.location_state, newVal: locationState },
    { field: "location_zip", oldVal: current.location_zip, newVal: locationZip },
    { field: "budget_min", oldVal: String(current.budget_min ?? ""), newVal: budgetMin || "" },
    { field: "budget_max", oldVal: String(current.budget_max ?? ""), newVal: budgetMax || "" },
    { field: "desired_start_date", oldVal: current.desired_start_date ?? "", newVal: desiredStartDate || "" },
    { field: "timeline", oldVal: current.timeline ?? "", newVal: timeline || "" },
  ];

  for (const check of fieldChecks) {
    if (check.oldVal !== check.newVal) {
      edits.push({
        field_name: check.field,
        old_value: check.oldVal,
        new_value: check.newVal,
      });
    }
  }

  if (edits.length === 0 && validFiles.length === 0) {
    return { error: "No changes detected." };
  }

  // Update the project
  const { error: updateError } = await supabase
    .from("projects")
    .update({
      title,
      description,
      completion_criteria: completionCriteria,
      trades,
      expertise_level: expertiseLevel,
      location_address: locationAddress,
      location_city: locationCity,
      location_state: locationState,
      location_zip: locationZip,
      budget_min: budgetMin ? parseFloat(budgetMin) : null,
      budget_max: budgetMax ? parseFloat(budgetMax) : null,
      desired_start_date: desiredStartDate || null,
      timeline: timeline || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("customer_id", user.id);

  if (updateError) {
    console.error("Update project error:", updateError);
    return { error: "Failed to update project. Please try again." };
  }

  // Record all edits in the audit trail
  const editRecords = edits.map((e) => ({
    project_id: projectId,
    ...e,
  }));
  await supabase.from("project_edits").insert(editRecords);

  // Handle new file uploads
  if (validFiles.length > 0) {
    let nextDisplayOrder =
      (existingProjectFiles || []).reduce((maxOrder, file) => {
        const order =
          typeof file.display_order === "number" ? file.display_order : -1;
        return Math.max(maxOrder, order);
      }, -1) + 1;

    for (const file of validFiles) {
      try {
        const fileExt = file.name.split(".").pop();
        const filePath = `projects/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("project-files")
          .upload(filePath, file, { contentType: file.type || undefined });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("project-files").getPublicUrl(filePath);

        let thumbnailUrl: string | null = null;
        if (file.type.startsWith("image/")) {
          thumbnailUrl = await generateAndUploadThumbnail(
            file,
            "project-files",
            filePath
          );
        } else if (isVideoFileType(file.type)) {
          thumbnailUrl = await generateAndUploadVideoPoster(
            file,
            "project-files",
            filePath
          );
        }

        const insertData: Record<string, unknown> = {
          project_id: projectId,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          display_order: nextDisplayOrder,
        };
        if (thumbnailUrl) {
          insertData.thumbnail_url = thumbnailUrl;
        }

        const { error: insertError } = await supabase
          .from("project_files")
          .insert(insertData);

        if (insertError) {
          console.error("project_files insert error:", insertError);
        }

        nextDisplayOrder += 1;
      } catch (err) {
        console.error("File processing error:", err);
      }
    }
  }

  // Notify existing bidders about the edit
  const { data: bids } = await supabase
    .from("bids")
    .select("bidder_id")
    .eq("project_id", projectId);

  if (bids && bids.length > 0) {
    const changedFieldNames = edits.map((e) =>
      e.field_name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
    const changedFieldsStr = changedFieldNames.join(", ");
    const notifications = bids.map((bid) => ({
      user_id: bid.bidder_id,
      type: "project_edited",
      title: "A project you bid on was edited",
      message: `"${current.title}" has been updated. Changed: ${changedFieldsStr}. Please review the changes.`,
      link: `/bidder/projects/${projectId}`,
    }));
    await supabase.from("notifications").insert(notifications);

    const bidderIds = [...new Set(bids.map((b) => b.bidder_id))];
    const { data: bidderProfiles } = await supabase
      .from("profiles")
      .select("user_id, email")
      .in("user_id", bidderIds);

    for (const bp of bidderProfiles || []) {
      if (bp.email) {
        sendProjectEditedEmail(
          bp.email,
          current.title,
          changedFieldsStr,
          projectId
        );
      }
    }
  }

  const latestClarifications = await getProjectAiCombinedClarifications(
    supabase,
    projectId
  );

  await runAndPersistProjectAiEstimate({
    supabase,
    userId: user.id,
    projectId,
    projectTitle: title,
    input: await buildProjectAiInput({
      project: {
        title,
        description,
        completion_criteria: completionCriteria,
        trades,
        expertise_level: expertiseLevel,
        location_address: locationAddress,
        location_city: locationCity,
        location_state: locationState,
        location_zip: locationZip,
        budget_min: budgetMin ? parseFloat(budgetMin) : null,
        budget_max: budgetMax ? parseFloat(budgetMax) : null,
        desired_start_date: desiredStartDate || null,
        timeline: timeline || null,
      },
      files: [
        ...(existingProjectFiles || []).map((file) => ({
          file_name: file.file_name,
          file_type: file.file_type,
          file_url: file.file_url,
        })),
        ...validFiles.map((file) => ({
          file_name: file.name,
          file_type: file.type,
          file_url: null,
        })),
      ],
      clarifications: latestClarifications,
    }),
    triggerType: "edit",
    isEditRefresh: true,
  });

  redirect(`/customer/projects/${projectId}`);
}
