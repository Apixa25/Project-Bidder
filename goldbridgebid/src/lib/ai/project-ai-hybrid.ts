import {
  analyzeProjectAiEstimate,
  type ProjectAiAnalysisInput,
  type ProjectAiAnalysisResult,
  type ProjectAiBenchmark,
  type ProjectAiQuestionOption,
  type ProjectAiRecommendedQuestion,
} from "@/lib/ai-estimates";

import { getProjectAiLlmSettings } from "./openai-client";
import { analyzeProjectWithLlm } from "./project-ai-llm";
import { classifyProjectWithLlm } from "./project-ai-classify";
import type { ProjectAiLlmOutput } from "./project-ai-llm-schema";
import type { ProjectAiClassifyOutput } from "./project-ai-classify-schema";

export interface LlmLaborHourEstimate {
  total_hours_low: number;
  total_hours_high: number;
  reasoning: string;
}

export type ProjectAiHybridAnalysisResult = ProjectAiAnalysisResult & {
  model_name: string;
  provider_name: string | null;
  fallback_used: boolean;
  prompt_version: string | null;
  llm_labor_hour_estimate: LlmLaborHourEstimate | null;
  classification: ProjectAiClassifyOutput | null;
};

function uniqStrings(values: string[], maxItems: number) {
  const seen = new Set<string>();
  const nextValues: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    nextValues.push(normalized);

    if (nextValues.length >= maxItems) {
      break;
    }
  }

  return nextValues;
}

function normalizeQuestionKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeQuestionOptions(options: ProjectAiQuestionOption[]) {
  return options
    .map((option) => {
      const label = option.label.trim().slice(0, 120);
      const id = normalizeQuestionKey(option.id || label);

      if (!label || !id) {
        return null;
      }

      return { id, label };
    })
    .filter((option): option is ProjectAiQuestionOption => Boolean(option))
    .slice(0, 8);
}

function sanitizeQuestion(
  question: ProjectAiLlmOutput["recommended_questions"][number]
): ProjectAiRecommendedQuestion | null {
  const questionKey = normalizeQuestionKey(
    question.question_key || question.question_text
  );
  const questionText = question.question_text.trim().slice(0, 240);

  if (!questionKey || !questionText) {
    return null;
  }

  return {
    question_key: questionKey,
    question_text: questionText,
    question_type: question.question_type,
    help_text: question.help_text?.trim().slice(0, 280) || null,
    placeholder: question.placeholder?.trim().slice(0, 180) || null,
    options: normalizeQuestionOptions(question.options),
  };
}

function sanitizeClassifyQuestion(
  question: ProjectAiClassifyOutput["recommended_questions"][number]
): ProjectAiRecommendedQuestion | null {
  const questionKey = normalizeQuestionKey(
    question.question_key || question.question_text
  );
  const questionText = question.question_text.trim().slice(0, 240);

  if (!questionKey || !questionText) {
    return null;
  }

  return {
    question_key: questionKey,
    question_text: questionText,
    question_type: question.question_type,
    help_text: question.help_text?.trim().slice(0, 280) || null,
    placeholder: question.placeholder?.trim().slice(0, 180) || null,
    options: normalizeQuestionOptions(question.options),
  };
}

function mergeQuestions(params: {
  classifyQuestions: ProjectAiClassifyOutput["recommended_questions"];
  llmQuestions: ProjectAiLlmOutput["recommended_questions"];
  rulesQuestions: ProjectAiRecommendedQuestion[];
  maxQuestions: number;
}) {
  const { classifyQuestions, llmQuestions, rulesQuestions, maxQuestions } =
    params;
  const mergedQuestions: ProjectAiRecommendedQuestion[] = [];
  const seenKeys = new Set<string>();

  // Classification questions first (most project-specific)
  for (const question of classifyQuestions) {
    const sanitized = sanitizeClassifyQuestion(question);
    if (!sanitized || seenKeys.has(sanitized.question_key)) continue;
    seenKeys.add(sanitized.question_key);
    mergedQuestions.push(sanitized);
  }

  // Then Call 2 LLM questions
  for (const question of llmQuestions) {
    const sanitized = sanitizeQuestion(question);
    if (!sanitized || seenKeys.has(sanitized.question_key)) continue;
    seenKeys.add(sanitized.question_key);
    mergedQuestions.push(sanitized);
  }

  // Then rules-engine questions as fallback
  for (const question of rulesQuestions) {
    if (seenKeys.has(question.question_key)) continue;
    seenKeys.add(question.question_key);
    mergedQuestions.push(question);
  }

  return mergedQuestions.slice(0, maxQuestions);
}

function buildRulesResult(
  analysis: ProjectAiAnalysisResult,
  params: {
    modelName?: string;
    fallbackUsed?: boolean;
    promptVersion?: string | null;
  } = {}
): ProjectAiHybridAnalysisResult {
  return {
    ...analysis,
    model_name: params.modelName || analysis.analysis_version,
    provider_name: params.modelName?.startsWith("openai:") ? "openai" : null,
    fallback_used: params.fallbackUsed ?? false,
    prompt_version: params.promptVersion ?? null,
    llm_labor_hour_estimate: null,
    classification: null,
  };
}

/**
 * Two-call hybrid analysis:
 *
 * Call 1 — classifyProjectWithLlm:
 *   Classifies the project type and generates standard requirements.
 *
 * Call 2 — analyzeProjectWithLlm:
 *   Given the classification context, generates clarification questions,
 *   labor hour estimates, and a detailed summary.
 *
 * Both calls are merged with the rules-engine analysis for completeness
 * scoring, benchmark data, and fallback.
 */
export async function analyzeProjectAiHybrid(
  input: ProjectAiAnalysisInput,
  benchmarks: ProjectAiBenchmark[]
): Promise<ProjectAiHybridAnalysisResult> {
  const rulesAnalysis = analyzeProjectAiEstimate(input, benchmarks);
  const settings = getProjectAiLlmSettings();

  if (!settings.enabled) {
    return buildRulesResult(rulesAnalysis);
  }

  let classification: ProjectAiClassifyOutput | null = null;
  let llmFailed = false;

  // ── Call 1: Classification + Requirements ──────────────────────────
  try {
    const classifyResult = await classifyProjectWithLlm(input);
    classification = classifyResult.classification;
    console.log(
      `[hybrid] Classification succeeded: type="${classification.project_classification.project_type_label}", ` +
      `sector="${classification.project_classification.construction_sector}", ` +
      `${classification.standard_requirements.length} requirements, ` +
      `${classification.recommended_questions.length} questions, ` +
      `confidence=${classification.confidence_level}`
    );
  } catch (error) {
    console.error(
      "[hybrid] Classification LLM call failed — proceeding without classification.",
      error
    );
    llmFailed = true;
  }

  // ── Call 2: Detailed analysis (questions, labor hours, summary) ────
  try {
    const llmResult = await analyzeProjectWithLlm({
      input,
      rulesAnalysis,
    });

    const classifyQuestions = classification?.recommended_questions || [];
    const merged = mergeQuestions({
      classifyQuestions,
      llmQuestions: llmResult.analysis.recommended_questions,
      rulesQuestions: rulesAnalysis.recommended_questions,
      maxQuestions: settings.maxQuestions,
    });

    const laborEstimate = llmResult.analysis.labor_hour_estimate ?? null;

    // Merge missing items from classification scope gaps
    const classificationMissingItems = (
      classification?.scope_gaps || []
    ).map((gap) => gap.description);
    const classificationCriticalInfo =
      classification?.customer_data_assessment.critical_missing_info || [];

    return {
      ...rulesAnalysis,
      confidence_level: llmResult.analysis.confidence_level,
      summary: llmResult.analysis.summary || rulesAnalysis.summary,
      missing_items: uniqStrings(
        [
          ...classificationCriticalInfo,
          ...classificationMissingItems,
          ...llmResult.analysis.missing_items,
          ...rulesAnalysis.missing_items,
        ],
        12
      ),
      assumptions: uniqStrings(
        [
          ...rulesAnalysis.assumptions,
          ...llmResult.analysis.assumptions,
        ],
        10
      ),
      exclusions: uniqStrings(
        [
          ...rulesAnalysis.exclusions,
          ...llmResult.analysis.exclusions,
        ],
        10
      ),
      recommended_questions: merged,
      analysis_version: "v2-openai-hybrid",
      model_name: llmResult.modelName,
      provider_name: "openai",
      fallback_used: llmFailed,
      prompt_version: llmResult.promptVersion,
      llm_labor_hour_estimate: laborEstimate,
      classification,
    };
  } catch (error) {
    console.error("[hybrid] Call 2 LLM FAILED — falling back to rules.", error);

    // If Call 1 succeeded but Call 2 failed, still return classification
    if (classification) {
      const classifyQuestions = classification.recommended_questions || [];
      const merged = mergeQuestions({
        classifyQuestions,
        llmQuestions: [],
        rulesQuestions: rulesAnalysis.recommended_questions,
        maxQuestions: settings.maxQuestions,
      });

      return {
        ...rulesAnalysis,
        recommended_questions: merged,
        analysis_version: "v2-classify-only",
        model_name: `fallback:${rulesAnalysis.analysis_version}`,
        provider_name: "openai",
        fallback_used: true,
        prompt_version: settings.promptVersion,
        llm_labor_hour_estimate: null,
        classification,
      };
    }

    return buildRulesResult(rulesAnalysis, {
      modelName: `fallback:${rulesAnalysis.analysis_version}`,
      fallbackUsed: true,
      promptVersion: settings.promptVersion,
    });
  }
}
