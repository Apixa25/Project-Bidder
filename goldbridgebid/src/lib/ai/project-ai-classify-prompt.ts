import type { ProjectAiAnalysisInput } from "@/lib/ai-estimates";
import { getMaxTradeWage, getWageForExpertiseLevel } from "@/lib/trade-wages";
import {
  TRADE_LABELS,
  EXPERTISE_LEVEL_LABELS,
  type TradeCategory,
  type ExpertiseLevel,
} from "@/types/database";

function truncateText(value: string | null | undefined, maxLength: number) {
  const normalized = (value || "").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

export function buildProjectAiClassifyPrompt(params: {
  input: ProjectAiAnalysisInput;
  promptVersion: string;
  maxInputChars: number;
}) {
  const { input, promptVersion, maxInputChars } = params;

  const tradeKeys = input.trades || [];
  const trades = tradeKeys.map((trade) => ({
    id: trade,
    label: TRADE_LABELS[trade as TradeCategory] || trade,
  }));

  const wageEntry = input.expertiseLevel
    ? getWageForExpertiseLevel(input.expertiseLevel)
    : getMaxTradeWage(tradeKeys);

  const expertiseLevelLabel = input.expertiseLevel
    ? EXPERTISE_LEVEL_LABELS[input.expertiseLevel as ExpertiseLevel] ||
      input.expertiseLevel
    : null;

  const trimmedInput = {
    title: truncateText(input.title, 120),
    description: truncateText(
      input.description,
      Math.floor(maxInputChars * 0.5)
    ),
    completionCriteria: truncateText(
      input.completionCriteria,
      Math.floor(maxInputChars * 0.2)
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
    files: (input.files || []).slice(0, 20).map((f) => ({
      file_name: f.file_name,
      file_type: f.file_type,
      file_kind: f.file_kind,
      extraction_summary: f.extraction_summary,
    })),
    clarificationAnswers: (input.clarificationAnswers || []).slice(0, 20),
  };

  return {
    system: [
      "You are an expert construction estimator working for a bidding marketplace.",
      "Your job right now is STEP 1 of the estimation process: classify this project and generate its complete list of standard requirements.",
      "",
      "STEP 1 OBJECTIVES:",
      "1. CLASSIFY the project — determine exactly what type of construction project this is (e.g., 'Kitchen Remodel', 'Residential Foundation', 'Roof Replacement', 'Commercial Tenant Improvement', etc.).",
      "2. GENERATE STANDARD REQUIREMENTS — list every scope item that would normally be part of this type of project. Think like an experienced contractor writing a complete scope of work.",
      "3. CROSS-REFERENCE with customer input — for each requirement, note whether the customer already mentioned it in their description, photos, or documents.",
      "4. IDENTIFY GAPS — what critical information is missing that a contractor would need to produce a real estimate?",
      "5. ASK SMART QUESTIONS — generate clarification questions that are specific to THIS project, not generic templates.",
      "",
      "CROSS-REFERENCING RULES (CRITICAL):",
      "- You MUST check ALL available customer data when deciding if a requirement is already covered:",
      "  a) The project title and description text",
      "  b) The completion criteria / desired outcomes",
      "  c) ALL uploaded files — read every extraction_summary carefully, these contain text extracted from photos (via OCR), documents, and PDFs the customer uploaded",
      "  d) ALL previous clarification answers — these are direct responses the customer already gave to earlier questions",
      "- If ANY of these data sources mention, imply, or address a standard requirement, set is_mentioned_by_customer=true and quote/paraphrase the relevant customer input in mention_summary.",
      "- Be generous in matching: if the customer uploaded a photo showing rebar and formwork, that counts as mentioning 'reinforcement' and 'formwork' even if they didn't type those words.",
      "- The goal is to MINIMIZE unnecessary re-entry. A customer who provided good data should see most items pre-confirmed, with only genuinely missing items left to review.",
      "",
      "QUANTITY EXTRACTION RULES:",
      "- When the customer states a specific quantity for a requirement (e.g., '20 cubic yards of concrete', '450 sq ft of tile', '12 recessed lights'), extract it into customer_stated_quantity (the number) and customer_stated_unit (the unit of measure).",
      "- Also check uploaded documents and file extraction summaries for quantities — blueprints and specs often contain dimensions and material callouts.",
      "- Use quantity_note to capture any context about the quantity (e.g., 'Customer stated 20 cu yd; actual may vary after soil test').",
      "- If no quantity is stated or inferable for a requirement, set all three quantity fields to null.",
      "- Do NOT guess quantities the customer hasn't provided — only extract what they actually stated or what appears in their documents.",
      "",
      "REQUIREMENTS GENERATION RULES:",
      "- Be thorough. A contractor looking at your requirements list should think 'yes, this covers everything I'd need to bid this job.'",
      "- Include ALL standard phases: demolition/removal (if applicable), preparation, rough-in work, materials, labor, finish work, cleanup, permits/inspections.",
      "- Mark each requirement as 'required' (always needed), 'recommended' (standard practice), 'optional' (nice to have), or 'conditional' (depends on site conditions).",
      "- Note which items the customer already addressed vs. which are missing from their description.",
      "- Do NOT invent quantities, dimensions, or specifications the customer hasn't provided — flag them as missing instead.",
      "- Do NOT fabricate permit requirements for specific jurisdictions you don't know about.",
      "",
      `The customer requested ${expertiseLevelLabel || "professional"}-level work at $${wageEntry.hourly_rate}/hr (${wageEntry.role_label}).`,
      "Return JSON only matching the provided schema.",
    ].join("\n"),
    user: JSON.stringify({
      promptVersion,
      step: "classify_and_generate_requirements",
      goal: "Classify this construction project, then generate a complete list of standard requirements a contractor would need to bid it. For EVERY requirement, check ALL data sources below (description, files, and previous answers) to determine if the customer already addressed it. Minimize what the customer has to re-enter.",
      project: trimmedInput,
      data_sources_to_cross_reference: {
        description: trimmedInput.description || "(none provided)",
        completion_criteria:
          trimmedInput.completionCriteria || "(none provided)",
        uploaded_files_with_extracted_content: trimmedInput.files.length > 0
          ? trimmedInput.files
          : "(no files uploaded)",
        previous_clarification_answers:
          trimmedInput.clarificationAnswers.length > 0
            ? trimmedInput.clarificationAnswers
            : "(no previous answers)",
      },
      laborRate: {
        hourly_rate: wageEntry.hourly_rate,
        role_label: wageEntry.role_label,
      },
    }),
  };
}
