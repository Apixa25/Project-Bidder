import type {
  ProjectAiAnalysisInput,
  ProjectAiAnalysisResult,
} from "@/lib/ai-estimates";
import { getMaxTradeWage, getWageForExpertiseLevel } from "@/lib/trade-wages";
import { TRADE_LABELS, EXPERTISE_LEVEL_LABELS, type TradeCategory, type ExpertiseLevel } from "@/types/database";

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

  const tradeKeys = input.trades || [];
  const trades = tradeKeys.map((trade) => ({
    id: trade,
    label: TRADE_LABELS[trade as TradeCategory] || trade,
  }));

  const wageEntry = input.expertiseLevel
    ? getWageForExpertiseLevel(input.expertiseLevel)
    : getMaxTradeWage(tradeKeys);

  const expertiseLevelLabel = input.expertiseLevel
    ? EXPERTISE_LEVEL_LABELS[input.expertiseLevel as ExpertiseLevel] || input.expertiseLevel
    : null;

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
      `The customer requested ${expertiseLevelLabel || "professional"}-level work. This project uses a single unified estimate priced at ${wageEntry.role_label} rates ($${wageEntry.hourly_rate}/hr). Do not split the estimate by trade.`,
      "Materials and quantities are the same regardless of contractor. Only labor rates may vary.",
      "We use an internal prevailing wage sheet — never search the internet for wage data.",
      `Estimate total labor hours needed for this project at the ${wageEntry.role_label} rate ($${wageEntry.hourly_rate}/hr).`,
      "Provide a low and high range for labor hours in the labor_hour_estimate field. If you cannot estimate hours with reasonable confidence, return null for labor_hour_estimate.",
      "Keep all output professional, concrete, and suitable for a customer-facing UI.",
      "Generate clarification questions that are SPECIFIC to this project — reference actual details from the description, location, and scope.",
      "Do NOT produce generic template questions like 'Do you expect permits?' or 'What materials do you want?' unless those are genuinely ambiguous for THIS project.",
      "Each question should help a contractor price this exact job more accurately.",
      "Return JSON only that matches the provided schema.",
    ].join(" "),
    user: JSON.stringify({
      promptVersion,
      goal: "Analyze this project, generate project-specific clarification questions, and estimate total labor hours at the given rate.",
      project: trimmedInput,
      laborRate: {
        hourly_rate: wageEntry.hourly_rate,
        role_label: wageEntry.role_label,
        note: "All estimates use this single licensed professional rate. Estimate how many hours at this rate the project requires. Return null for labor_hour_estimate only if you truly cannot estimate.",
      },
      existingAnalysis: {
        status: rulesAnalysis.status,
        scopeCompletenessScore: rulesAnalysis.scope_completeness_score,
        confidenceLevel: rulesAnalysis.confidence_level,
        summary: rulesAnalysis.summary,
        missingItems: rulesAnalysis.missing_items,
        assumptions: rulesAnalysis.assumptions,
        exclusions: rulesAnalysis.exclusions,
      },
    }),
  };
}
