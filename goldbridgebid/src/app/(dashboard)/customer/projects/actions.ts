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
  analyzeProjectAiEstimate,
  type ProjectAiAnalysisInput,
  type ProjectAiAnalysisResult,
  type ProjectAiClarificationAnswerInput,
  type ProjectAiRecommendedQuestion,
} from "@/lib/ai-estimates";

interface CreateProjectResult {
  error: string | null;
  redirectUrl: string | null;
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

function buildProjectAiInput(params: {
  project: {
    title: string;
    description: string;
    completion_criteria: string;
    trades: string[];
    location_address: string;
    location_city: string;
    location_state: string;
    location_zip: string;
    budget_min: number | null;
    budget_max: number | null;
    desired_start_date: string | null;
    timeline: string | null;
  };
  files: Array<{ file_name?: string | null; file_type?: string | null }>;
  clarifications: Array<{
    question_key: string;
    answer_value_json: unknown;
    status: "pending" | "answered" | "dismissed";
  }>;
}): ProjectAiAnalysisInput {
  const { project, files, clarifications } = params;

  return {
    title: project.title,
    description: project.description,
    completionCriteria: project.completion_criteria,
    trades: project.trades,
    locationAddress: project.location_address,
    locationCity: project.location_city,
    locationState: project.location_state,
    locationZip: project.location_zip,
    budgetMin: project.budget_min,
    budgetMax: project.budget_max,
    desiredStartDate: project.desired_start_date,
    timeline: project.timeline,
    files,
    clarificationAnswers: clarifications.map((item) => ({
      question_key: item.question_key,
      answer_value_json: item.answer_value_json,
      status: item.status,
    })),
  };
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
  const analysis = analyzeProjectAiEstimate(input, benchmarks);
  const effectiveStatus = isEditRefresh ? "stale" : analysis.status;
  const publishedToBidders = isEditRefresh
    ? false
    : (previousEstimate?.published_to_bidders ?? false);

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
      model_name: analysis.analysis_version,
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

  const analysis = analyzeProjectAiEstimate(input, await getCostEstimates());
  return { error: null, analysis };
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

  const [{ data: project }, { data: files }, { data: clarifications }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, title, description, completion_criteria, trades, location_address, location_city, location_state, location_zip, budget_min, budget_max, desired_start_date, timeline"
        )
        .eq("id", projectId)
        .eq("customer_id", user.id)
        .single(),
      supabase
        .from("project_files")
        .select("file_name, file_type")
        .eq("project_id", projectId),
      supabase
        .from("project_ai_clarifications")
        .select("question_key, answer_value_json, status")
        .eq("project_id", projectId),
    ]);

  if (!project) {
    return { error: "Project not found." };
  }

  const analysis = await runAndPersistProjectAiEstimate({
    supabase,
    userId: user.id,
    projectId,
    projectTitle: project.title,
    input: buildProjectAiInput({
      project,
      files: files || [],
      clarifications:
        (clarifications as Array<{
          question_key: string;
          answer_value_json: unknown;
          status: "pending" | "answered" | "dismissed";
        }>) || [],
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
        "id, title, description, completion_criteria, trades, location_address, location_city, location_state, location_zip, budget_min, budget_max, desired_start_date, timeline"
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

  const [{ data: files }, { data: clarifications }] = await Promise.all([
    supabase
      .from("project_files")
      .select("file_name, file_type")
      .eq("project_id", projectId),
    supabase
      .from("project_ai_clarifications")
      .select("question_key, answer_value_json, status")
      .eq("project_id", projectId),
  ]);

  const analysis = await runAndPersistProjectAiEstimate({
    supabase,
    userId: user.id,
    projectId,
    projectTitle: project.title,
    input: buildProjectAiInput({
      project,
      files: files || [],
      clarifications:
        (clarifications as Array<{
          question_key: string;
          answer_value_json: unknown;
          status: "pending" | "answered" | "dismissed";
        }>) || [],
    }),
    triggerType: "clarification_answered",
  });

  return { error: null, analysis };
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

  if (published && estimate.status !== "ready") {
    return {
      error: "Only ready AI baselines can be shared with bidders.",
    };
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
  return { error: null, success: true };
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
  const completionCriteria = formData.get("completionCriteria") as string;
  const tradesRaw = formData.getAll("trades") as string[];
  const locationAddress = formData.get("locationAddress") as string;
  const locationCity = formData.get("locationCity") as string;
  const locationState = formData.get("locationState") as string;
  const locationZip = formData.get("locationZip") as string;
  const budgetMin = formData.get("budgetMin") as string;
  const budgetMax = formData.get("budgetMax") as string;
  const desiredStartDate = formData.get("desiredStartDate") as string;
  const timeline = formData.get("timeline") as string;

  console.info("createProject: received submit", {
    userId: user.id,
    hasTitle: Boolean(title),
    hasDescription: Boolean(description),
    hasCompletionCriteria: Boolean(completionCriteria),
    tradeCount: tradesRaw.length,
    hasLocationAddress: Boolean(locationAddress),
    hasLocationCity: Boolean(locationCity),
    hasLocationState: Boolean(locationState),
    hasLocationZip: Boolean(locationZip),
    enablePaidEstimate: formData.get("enablePaidEstimate") === "true",
    rewardAmount: formData.get("rewardAmount"),
    maxPaidSlots: formData.get("maxPaidSlots"),
    filter: formData.get("filter"),
    fileCount: formData.getAll("files").filter((file) => file instanceof File && file.size > 0).length,
  });

  if (
    !title ||
    !description ||
    !completionCriteria ||
    tradesRaw.length === 0 ||
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

  const trades = tradesRaw as TradeCategory[];

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      customer_id: user.id,
      title,
      description,
      completion_criteria: completionCriteria,
      trades,
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
      locationAddress,
      locationCity,
      locationState,
      locationZip,
      budgetMin: budgetMin ? parseFloat(budgetMin) : null,
      budgetMax: budgetMax ? parseFloat(budgetMax) : null,
      desiredStartDate: desiredStartDate || null,
      timeline: timeline || null,
      files: validFiles.map((file) => ({
        file_name: file.name,
        file_type: file.type,
      })),
      clarificationAnswers: [],
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

  redirect("/customer/projects");
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
  const completionCriteria = formData.get("completionCriteria") as string;
  const tradesRaw = formData.getAll("trades") as string[];
  const locationAddress = formData.get("locationAddress") as string;
  const locationCity = formData.get("locationCity") as string;
  const locationState = formData.get("locationState") as string;
  const locationZip = formData.get("locationZip") as string;
  const budgetMin = formData.get("budgetMin") as string;
  const budgetMax = formData.get("budgetMax") as string;
  const desiredStartDate = formData.get("desiredStartDate") as string;
  const timeline = formData.get("timeline") as string;

  if (
    !title ||
    !description ||
    !completionCriteria ||
    tradesRaw.length === 0 ||
    !locationAddress ||
    !locationCity ||
    !locationState ||
    !locationZip
  ) {
    return { error: "Please fill in all required fields." };
  }

  const { data: existingProjectFiles } = await supabase
    .from("project_files")
    .select("id, file_type, display_order, uploaded_at")
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

  const trades = tradesRaw as TradeCategory[];

  // Track all changes for the audit trail
  const edits: { field_name: string; old_value: string; new_value: string }[] = [];

  const fieldChecks: { field: string; oldVal: string; newVal: string }[] = [
    { field: "title", oldVal: current.title, newVal: title },
    { field: "description", oldVal: current.description, newVal: description },
    { field: "completion_criteria", oldVal: current.completion_criteria, newVal: completionCriteria },
    { field: "trades", oldVal: JSON.stringify(current.trades), newVal: JSON.stringify(trades) },
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

  const { data: latestClarifications } = await supabase
    .from("project_ai_clarifications")
    .select("question_key, answer_value_json, status")
    .eq("project_id", projectId);

  await runAndPersistProjectAiEstimate({
    supabase,
    userId: user.id,
    projectId,
    projectTitle: title,
    input: buildProjectAiInput({
      project: {
        title,
        description,
        completion_criteria: completionCriteria,
        trades,
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
          file_name: null,
          file_type: file.file_type,
        })),
        ...validFiles.map((file) => ({
          file_name: file.name,
          file_type: file.type,
        })),
      ],
      clarifications:
        (latestClarifications as Array<{
          question_key: string;
          answer_value_json: unknown;
          status: "pending" | "answered" | "dismissed";
        }>) || [],
    }),
    triggerType: "edit",
    isEditRefresh: true,
  });

  redirect(`/customer/projects/${projectId}`);
}
