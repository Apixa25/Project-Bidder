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
import type { ProjectAiLlmOutput } from "./project-ai-llm-schema";

export type ProjectAiHybridAnalysisResult = ProjectAiAnalysisResult & {
  model_name: string;
  provider_name: string | null;
  fallback_used: boolean;
  prompt_version: string | null;
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

      return {
        id,
        label,
      };
    })
    .filter((option): option is ProjectAiQuestionOption => Boolean(option))
    .slice(0, 8);
}

function sanitizeQuestion(
  question: ProjectAiLlmOutput["recommended_questions"][number]
): ProjectAiRecommendedQuestion | null {
  const questionKey = normalizeQuestionKey(question.question_key || question.question_text);
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
  llmQuestions: ProjectAiLlmOutput["recommended_questions"];
  rulesQuestions: ProjectAiRecommendedQuestion[];
  maxQuestions: number;
}) {
  const { llmQuestions, rulesQuestions, maxQuestions } = params;
  const mergedQuestions: ProjectAiRecommendedQuestion[] = [];
  const seenKeys = new Set<string>();

  for (const question of llmQuestions) {
    const sanitized = sanitizeQuestion(question);
    if (!sanitized || seenKeys.has(sanitized.question_key)) {
      continue;
    }

    seenKeys.add(sanitized.question_key);
    mergedQuestions.push(sanitized);
  }

  for (const question of rulesQuestions) {
    if (seenKeys.has(question.question_key)) {
      continue;
    }

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
  };
}

export async function analyzeProjectAiHybrid(
  input: ProjectAiAnalysisInput,
  benchmarks: ProjectAiBenchmark[]
): Promise<ProjectAiHybridAnalysisResult> {
  const rulesAnalysis = analyzeProjectAiEstimate(input, benchmarks);
  const settings = getProjectAiLlmSettings();

  if (!settings.enabled) {
    return buildRulesResult(rulesAnalysis);
  }

  try {
    const llmResult = await analyzeProjectWithLlm({
      input,
      rulesAnalysis,
    });

    return {
      ...rulesAnalysis,
      confidence_level: llmResult.analysis.confidence_level,
      summary: llmResult.analysis.summary || rulesAnalysis.summary,
      missing_items: uniqStrings(
        [...llmResult.analysis.missing_items, ...rulesAnalysis.missing_items],
        12
      ),
      assumptions: uniqStrings(
        [...rulesAnalysis.assumptions, ...llmResult.analysis.assumptions],
        10
      ),
      exclusions: uniqStrings(
        [...rulesAnalysis.exclusions, ...llmResult.analysis.exclusions],
        10
      ),
      recommended_questions: mergeQuestions({
        llmQuestions: llmResult.analysis.recommended_questions,
        rulesQuestions: rulesAnalysis.recommended_questions,
        maxQuestions: settings.maxQuestions,
      }),
      analysis_version: "v2-openai-hybrid",
      model_name: llmResult.modelName,
      provider_name: "openai",
      fallback_used: false,
      prompt_version: llmResult.promptVersion,
    };
  } catch (error) {
    console.error("Project AI LLM analysis failed; falling back to rules.", error);
    return buildRulesResult(rulesAnalysis, {
      modelName: `fallback:${rulesAnalysis.analysis_version}`,
      fallbackUsed: true,
      promptVersion: settings.promptVersion,
    });
  }
}
