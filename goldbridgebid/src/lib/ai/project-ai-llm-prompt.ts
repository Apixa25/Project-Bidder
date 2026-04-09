import type {
  ProjectAiAnalysisInput,
  ProjectAiAnalysisResult,
} from "@/lib/ai-estimates";
import { TRADE_LABELS, type TradeCategory } from "@/types/database";

function truncateText(value: string | null | undefined, maxLength: number) {
  const normalized = (value || "").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

export function buildProjectAiLlmPrompt(params: {
  input: ProjectAiAnalysisInput;
  rulesAnalysis: ProjectAiAnalysisResult;
  promptVersion: string;
  maxInputChars: number;
}) {
  const { input, rulesAnalysis, promptVersion, maxInputChars } = params;

  const trades = (input.trades || []).map((trade) => ({
    id: trade,
    label: TRADE_LABELS[trade as TradeCategory] || trade,
  }));

  const trimmedInput = {
    title: truncateText(input.title, 120),
    description: truncateText(input.description, Math.floor(maxInputChars * 0.45)),
    completionCriteria: truncateText(
      input.completionCriteria,
      Math.floor(maxInputChars * 0.25)
    ),
    locationAddress: truncateText(input.locationAddress, 160),
    locationCity: truncateText(input.locationCity, 80),
    locationState: truncateText(input.locationState, 40),
    locationZip: truncateText(input.locationZip, 20),
    budgetMin: input.budgetMin ?? null,
    budgetMax: input.budgetMax ?? null,
    desiredStartDate: input.desiredStartDate ?? null,
    timeline: truncateText(input.timeline, 120),
    trades,
    files: (input.files || []).slice(0, 20),
    clarificationAnswers: (input.clarificationAnswers || []).slice(0, 20),
  };

  return {
    system: [
      "You are helping a construction bidding marketplace improve estimate readiness for customer projects.",
      "Return practical, contractor-useful clarification questions and concise scope analysis.",
      "Do not invent facts, quantities, permit requirements, site conditions, or material selections.",
      "If details are missing, state that they are missing instead of guessing.",
      "Keep all output professional, concrete, and suitable for a customer-facing UI.",
      "Recommended questions should focus on scope, access, quantities, materials, schedule, and trade-specific pricing drivers.",
      "Return JSON only that matches the provided schema.",
    ].join(" "),
    user: JSON.stringify({
      promptVersion,
      goal: "Improve the existing deterministic project estimate analysis without changing baseline pricing math.",
      project: trimmedInput,
      existingAnalysis: {
        status: rulesAnalysis.status,
        scopeCompletenessScore: rulesAnalysis.scope_completeness_score,
        confidenceLevel: rulesAnalysis.confidence_level,
        summary: rulesAnalysis.summary,
        missingItems: rulesAnalysis.missing_items,
        assumptions: rulesAnalysis.assumptions,
        exclusions: rulesAnalysis.exclusions,
        recommendedQuestions: rulesAnalysis.recommended_questions,
      },
    }),
  };
}
