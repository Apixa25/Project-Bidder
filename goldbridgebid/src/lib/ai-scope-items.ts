import type {
  ProjectAiAnalysisInput,
  ProjectAiAnalysisResult,
  ProjectAiClarificationAnswerInput,
  ProjectAiClarificationQuestionType,
} from "@/lib/ai-estimates";
import {
  getMaxTradeWage,
  getWageForExpertiseLevel,
  type TradeWageEntry,
} from "@/lib/trade-wages";
import { TRADE_LABELS, type TradeCategory } from "@/types/database";
import type {
  ProjectAiClassifyOutput,
  ProjectAiClassifyRequirement,
  AiScopeItemCategory,
} from "@/lib/ai/project-ai-classify-schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectAiScopeItemRequiredStatus =
  | "required"
  | "likely"
  | "possible"
  | "unknown";

export type ProjectAiScopeItemConfidenceLevel = "low" | "medium" | "high";

export type ProjectAiScopeItemSourceMethod =
  | "historical_bids"
  | "ai_assembly"
  | "budget_signal"
  | "insufficient_signal"
  | "manual_review"
  | "llm_generated";

// Includes new categories from the classify schema + legacy values for backward compat
export type ProjectAiScopeItemCategory =
  | AiScopeItemCategory
  | "utility"
  | "water"
  | "sewer"
  | "grading"
  | "drainage"
  | "landscape"
  | "permit"
  | "delivery";

export type ProjectAiScopeItemCustomerInclusion =
  | "yes"
  | "no"
  | "not_sure"
  | null;

export interface ProjectAiScopeItem {
  id: string;
  project_id: string;
  item_key: string;
  item_label: string;
  item_category: ProjectAiScopeItemCategory;
  required_status: ProjectAiScopeItemRequiredStatus;
  confidence_level: ProjectAiScopeItemConfidenceLevel;
  description: string | null;
  why_it_may_apply: string | null;
  confidence_reason: string | null;
  estimated_low: number | null;
  estimated_high: number | null;
  labor_low: number | null;
  labor_high: number | null;
  material_low: number | null;
  material_high: number | null;
  equipment_low: number | null;
  equipment_high: number | null;
  quantity_drivers_json: ProjectAiScopeItemQuantityDriver[];
  evidence_signals_json: ProjectAiScopeItemEvidenceSignal[];
  assumptions_json: string[];
  exclusions_json: string[];
  source_method: ProjectAiScopeItemSourceMethod;
  needs_clarification: boolean;
  customer_inclusion: ProjectAiScopeItemCustomerInclusion;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectAiItemClarification {
  id: string;
  project_id: string;
  scope_item_id: string;
  question_key: string;
  question_text: string;
  question_type: ProjectAiClarificationQuestionType;
  help_text: string | null;
  placeholder: string | null;
  options_json: Array<Record<string, unknown>>;
  answer_value_json: unknown;
  status: "pending" | "answered" | "dismissed";
  asked_by: "ai" | "admin";
  display_order: number;
  answered_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectAiScopeItemDraft = Omit<
  ProjectAiScopeItem,
  "id" | "project_id" | "created_at" | "updated_at"
>;

export interface ProjectAiScopeItemQuantityDriver {
  key: string;
  label: string;
  value: string;
  unit: string | null;
  confidence: ProjectAiScopeItemConfidenceLevel;
  source:
    | "project_text"
    | "item_answer"
    | "budget_signal"
    | "trade_history"
    | "ai_inference";
}

export interface ProjectAiScopeItemEvidenceSignal {
  key: string;
  label: string;
  summary: string;
  strength: "direct" | "supporting" | "limited";
  source:
    | "project_text"
    | "item_answer"
    | "uploaded_photo"
    | "uploaded_video"
    | "uploaded_document"
    | "trade_history"
    | "ai_inference";
  matched_files?: string[];
  matched_signals?: string[];
  matched_excerpts?: string[];
  verification_gap?: string | null;
  recommended_uploads?: string[];
}

export interface ProjectAiItemClarificationDraft
  extends Omit<
    ProjectAiItemClarification,
    "id" | "project_id" | "scope_item_id" | "created_at" | "updated_at"
  > {
  scope_item_key: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasMeaningfulAnswer(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulAnswer(item));
  return value !== null && value !== undefined;
}

function getClarificationAnswer(
  answers: ProjectAiClarificationAnswerInput[],
  questionKey: string
) {
  return answers.find(
    (entry) =>
      entry.question_key === questionKey &&
      entry.status !== "dismissed" &&
      hasMeaningfulAnswer(entry.answer_value_json)
  )?.answer_value_json;
}

function roundCurrency(value: number) {
  return Math.round(value / 50) * 50;
}

function normalizeRange(low: number, high: number) {
  const clamped = {
    low: Math.max(0, Math.min(low, high)),
    high: Math.max(Math.max(low, high), 0),
  };
  return {
    low: roundCurrency(clamped.low),
    high: roundCurrency(clamped.high),
  };
}

function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Cost split ratios by category (labor / material / equipment)
// ---------------------------------------------------------------------------

function getItemCostSplitRatios(category: ProjectAiScopeItemCategory) {
  switch (category) {
    case "electrical":
      return { labor: 0.55, material: 0.35, equipment: 0.1 };
    case "plumbing":
      return { labor: 0.5, material: 0.4, equipment: 0.1 };
    case "foundation":
    case "concrete":
    case "masonry":
      return { labor: 0.35, material: 0.5, equipment: 0.15 };
    case "excavation":
    case "site_prep":
    case "grading":
    case "demolition":
      return { labor: 0.4, material: 0.2, equipment: 0.4 };
    case "framing":
    case "structural":
      return { labor: 0.45, material: 0.45, equipment: 0.1 };
    case "roofing":
      return { labor: 0.45, material: 0.45, equipment: 0.1 };
    case "hvac":
      return { labor: 0.4, material: 0.45, equipment: 0.15 };
    case "insulation":
    case "drywall":
      return { labor: 0.5, material: 0.4, equipment: 0.1 };
    case "painting":
      return { labor: 0.6, material: 0.35, equipment: 0.05 };
    case "flooring":
    case "tile":
      return { labor: 0.45, material: 0.5, equipment: 0.05 };
    case "cabinetry":
      return { labor: 0.35, material: 0.6, equipment: 0.05 };
    case "windows_doors":
      return { labor: 0.35, material: 0.6, equipment: 0.05 };
    case "siding_exterior":
      return { labor: 0.45, material: 0.45, equipment: 0.1 };
    case "waterproofing":
      return { labor: 0.5, material: 0.4, equipment: 0.1 };
    case "landscaping":
    case "landscape":
      return { labor: 0.5, material: 0.3, equipment: 0.2 };
    case "permits_inspections":
    case "permit":
      return { labor: 0.9, material: 0.05, equipment: 0.05 };
    case "materials_delivery":
    case "delivery":
      return { labor: 0.3, material: 0.1, equipment: 0.6 };
    case "cleanup":
      return { labor: 0.7, material: 0.1, equipment: 0.2 };
    case "safety":
      return { labor: 0.6, material: 0.3, equipment: 0.1 };
    case "general_labor":
      return { labor: 0.75, material: 0.15, equipment: 0.1 };
    default:
      return { labor: 0.5, material: 0.35, equipment: 0.15 };
  }
}

// ---------------------------------------------------------------------------
// Map LLM classification requirements → scope item drafts
// ---------------------------------------------------------------------------

function mapInclusionToRequiredStatus(
  inclusion: ProjectAiClassifyRequirement["recommended_inclusion"]
): ProjectAiScopeItemRequiredStatus {
  switch (inclusion) {
    case "required":
      return "required";
    case "recommended":
      return "likely";
    case "optional":
    case "conditional":
      return "possible";
    default:
      return "unknown";
  }
}

function mapCostSignificanceToConfidence(
  significance: ProjectAiClassifyRequirement["typical_cost_significance"],
  isMentioned: boolean
): ProjectAiScopeItemConfidenceLevel {
  if (isMentioned && significance === "high") return "high";
  if (isMentioned) return "medium";
  if (significance === "high") return "medium";
  return "low";
}

function buildScopeItemFromRequirement(params: {
  requirement: ProjectAiClassifyRequirement;
  index: number;
  input: ProjectAiAnalysisInput;
  analysis: ProjectAiAnalysisResult;
  wageEntry: TradeWageEntry;
}): ProjectAiScopeItemDraft {
  const { requirement, index, input, analysis, wageEntry } = params;

  const requiredStatus = mapInclusionToRequiredStatus(
    requirement.recommended_inclusion
  );
  const confidence = mapCostSignificanceToConfidence(
    requirement.typical_cost_significance,
    requirement.is_mentioned_by_customer
  );

  const evidenceSignals: ProjectAiScopeItemEvidenceSignal[] = [];
  const quantityDrivers: ProjectAiScopeItemQuantityDriver[] = [];

  if (requirement.is_mentioned_by_customer && requirement.mention_summary) {
    evidenceSignals.push({
      key: "customer_description",
      label: "Customer mentioned this",
      summary: requirement.mention_summary,
      strength: "direct",
      source: "project_text",
    });
  }

  if (!requirement.is_mentioned_by_customer) {
    evidenceSignals.push({
      key: "standard_requirement",
      label: "Standard for this project type",
      summary: requirement.why_standard,
      strength: "supporting",
      source: "ai_inference",
    });
  }

  // Extract customer-stated quantities into structured drivers
  if (
    requirement.customer_stated_quantity !== null &&
    requirement.customer_stated_quantity !== undefined
  ) {
    quantityDrivers.push({
      key: "customer_stated_quantity",
      label: "Customer-provided quantity",
      value: String(requirement.customer_stated_quantity),
      unit: requirement.customer_stated_unit || null,
      confidence: "high",
      source: "project_text",
    });

    if (requirement.quantity_note) {
      quantityDrivers.push({
        key: "quantity_note",
        label: "Quantity context",
        value: requirement.quantity_note,
        unit: null,
        confidence: "medium",
        source: "project_text",
      });
    }

    evidenceSignals.push({
      key: "customer_quantity",
      label: "Customer specified quantity",
      summary: `${requirement.customer_stated_quantity} ${requirement.customer_stated_unit || "units"} — ${requirement.quantity_note || "as stated by customer"}`,
      strength: "direct",
      source: "project_text",
    });
  }

  const hasCustomerQuantity =
    requirement.customer_stated_quantity !== null &&
    requirement.customer_stated_quantity !== undefined;

  return {
    item_key: requirement.item_key,
    item_label: requirement.item_label,
    item_category: requirement.category,
    required_status: requiredStatus,
    confidence_level: hasCustomerQuantity
      ? "high"
      : confidence,
    description: requirement.description,
    why_it_may_apply: requirement.why_standard,
    confidence_reason: hasCustomerQuantity
      ? `The customer provided a specific quantity (${requirement.customer_stated_quantity} ${requirement.customer_stated_unit || "units"}) for this item.`
      : requirement.is_mentioned_by_customer
        ? "The customer's description directly references this scope item."
        : `This is a standard requirement for this project type. ${requirement.why_standard}`,
    estimated_low: null,
    estimated_high: null,
    labor_low: null,
    labor_high: null,
    material_low: null,
    material_high: null,
    equipment_low: null,
    equipment_high: null,
    quantity_drivers_json: quantityDrivers,
    evidence_signals_json: evidenceSignals,
    assumptions_json: hasCustomerQuantity
      ? [
          `Customer stated ${requirement.customer_stated_quantity} ${requirement.customer_stated_unit || "units"}.`,
          `This item is listed as ${requirement.recommended_inclusion} for this project type.`,
        ]
      : [
          `This item is listed as ${requirement.recommended_inclusion} for this project type.`,
        ],
    exclusions_json: [
      "Final pricing depends on site conditions, contractor availability, and material selections.",
    ],
    source_method: "llm_generated",
    needs_clarification: !requirement.is_mentioned_by_customer && !hasCustomerQuantity,
    customer_inclusion: requirement.is_mentioned_by_customer ? "yes" : null,
    display_order: index,
  };
}

/**
 * Applies budget-anchored pricing to a scope item when we have a customer
 * budget and the item's typical cost significance. This gives a rough
 * directional range until the detailed estimate (Call 2) runs.
 */
function applyInitialPricing(params: {
  item: ProjectAiScopeItemDraft;
  input: ProjectAiAnalysisInput;
  totalItems: number;
  highCostCount: number;
  wageEntry: TradeWageEntry;
}): ProjectAiScopeItemDraft {
  const { item, input, totalItems, highCostCount, wageEntry } = params;

  const budgetMid =
    input.budgetMin && input.budgetMax
      ? (input.budgetMin + input.budgetMax) / 2
      : input.budgetMin || input.budgetMax || null;

  if (!budgetMid || totalItems === 0) {
    return item;
  }

  // Distribute budget proportionally based on item category ratios.
  // High-significance items get more share than low ones.
  const itemWeight =
    item.required_status === "required"
      ? 1.5
      : item.required_status === "likely"
        ? 1.0
        : 0.5;

  const totalWeight = totalItems * 1.0;
  const share = (itemWeight / totalWeight) * budgetMid;

  const range = normalizeRange(share * 0.7, share * 1.4);
  const ratios = getItemCostSplitRatios(item.item_category);

  const drivers: ProjectAiScopeItemQuantityDriver[] = [
    {
      key: "budget_share",
      label: "Budget-derived share",
      value: formatCurrencyValue(Math.round((range.low + range.high) / 2)),
      unit: null,
      confidence: "low",
      source: "budget_signal",
    },
  ];

  if (wageEntry.hourly_rate > 0) {
    const laborLow = range.low * ratios.labor;
    const laborHigh = range.high * ratios.labor;
    const hoursLow = Math.round(laborLow / wageEntry.hourly_rate);
    const hoursHigh = Math.round(laborHigh / wageEntry.hourly_rate);

    drivers.push({
      key: "estimated_labor_hours",
      label: "Estimated labor hours",
      value:
        hoursLow === hoursHigh
          ? String(hoursLow)
          : `${hoursLow} – ${hoursHigh}`,
      unit: "hrs",
      confidence: "low",
      source: "budget_signal",
    });
  }

  return {
    ...item,
    estimated_low: range.low,
    estimated_high: range.high,
    labor_low: roundCurrency(range.low * ratios.labor),
    labor_high: roundCurrency(range.high * ratios.labor),
    material_low: roundCurrency(range.low * ratios.material),
    material_high: roundCurrency(range.high * ratios.material),
    equipment_low: roundCurrency(range.low * ratios.equipment),
    equipment_high: roundCurrency(range.high * ratios.equipment),
    quantity_drivers_json: [...item.quantity_drivers_json, ...drivers],
    assumptions_json: [
      ...item.assumptions_json,
      "Initial pricing is derived from the customer's stated budget and will be refined after detailed scope confirmation.",
    ],
  };
}

// ---------------------------------------------------------------------------
// Main entry points
// ---------------------------------------------------------------------------

/**
 * Builds scope items from the LLM classification output.
 * Replaces the old hardcoded keyword-based generation.
 */
export function buildProjectAiScopeItems(params: {
  input: ProjectAiAnalysisInput;
  analysis: ProjectAiAnalysisResult;
  classification: ProjectAiClassifyOutput | null;
  llmLaborHourEstimate?: {
    total_hours_low: number;
    total_hours_high: number;
    reasoning: string;
  } | null;
}): ProjectAiScopeItemDraft[] {
  const { input, analysis, classification } = params;
  const tradeKeys = analysis.trade_breakdown.map((t) => t.trade);
  const wageEntry = input.expertiseLevel
    ? getWageForExpertiseLevel(input.expertiseLevel)
    : getMaxTradeWage(tradeKeys);

  if (!classification) {
    // Fallback: create a single unified package (same as old behavior
    // but without modular-home patterns). This only runs if the LLM
    // classification call failed or was disabled.
    return [
      {
        item_key: "unified_project_package",
        item_label: "Project work package",
        item_category: "other",
        required_status: "required",
        confidence_level: "low",
        description: `Unified estimate for the full project scope. Labor priced at ${wageEntry.role_label} rate ($${wageEntry.hourly_rate}/hr).`,
        why_it_may_apply:
          "This is a fallback scope item because project classification was not available.",
        confidence_reason:
          "Classification was unavailable — this is a placeholder until the AI can analyze the project type.",
        estimated_low: analysis.baseline_low,
        estimated_high: analysis.baseline_high,
        labor_low: null,
        labor_high: null,
        material_low: null,
        material_high: null,
        equipment_low: null,
        equipment_high: null,
        quantity_drivers_json: [],
        evidence_signals_json: [],
        assumptions_json: [
          `Labor costed at ${wageEntry.role_label} prevailing wage ($${wageEntry.hourly_rate}/hr).`,
        ],
        exclusions_json: [
          "This is a placeholder estimate. Run the AI analysis again with LLM enabled for detailed scope items.",
        ],
        source_method: "insufficient_signal",
        needs_clarification: true,
        customer_inclusion: null,
        display_order: 0,
      },
    ];
  }

  // Build scope items from LLM classification requirements
  const requirements = classification.standard_requirements;

  const highCostCount = requirements.filter(
    (r) => r.typical_cost_significance === "high"
  ).length;

  const items = requirements.map((requirement, index) =>
    buildScopeItemFromRequirement({
      requirement,
      index,
      input,
      analysis,
      wageEntry,
    })
  );

  // Apply initial budget-anchored pricing
  return items.map((item) =>
    applyInitialPricing({
      item,
      input,
      totalItems: items.length,
      highCostCount,
      wageEntry,
    })
  );
}

/**
 * Generates per-item clarification questions.
 * Now produces a single generic "scope detail" question for items
 * the customer hasn't confirmed yet, instead of hardcoded
 * modular-home questions.
 */
export function buildProjectAiItemClarifications(params: {
  items: ProjectAiScopeItemDraft[];
  input: ProjectAiAnalysisInput;
}): ProjectAiItemClarificationDraft[] {
  const { items, input } = params;
  const clarificationAnswers = input.clarificationAnswers || [];

  return items.flatMap((item) => {
    const blueprints: Array<{
      question_key: string;
      question_text: string;
      question_type: ProjectAiClarificationQuestionType;
      help_text: string | null;
      placeholder: string | null;
      options_json: Array<Record<string, unknown>>;
    }> = [];

    // If the customer hasn't confirmed this item, ask if they want to include it
    if (
      item.customer_inclusion === null &&
      item.required_status !== "required"
    ) {
      blueprints.push({
        question_key: `scope_item__${item.item_key}__include`,
        question_text: `Do you want to include "${item.item_label}" in your project scope?`,
        question_type: "single_select",
        help_text:
          item.why_it_may_apply ||
          "This is a standard requirement for your project type.",
        placeholder: null,
        options_json: [
          { id: "yes", label: "Yes, include this" },
          { id: "no", label: "No, exclude this" },
          { id: "not_sure", label: "Not sure yet" },
        ],
      });
    }

    // If item needs more detail for pricing
    if (item.needs_clarification && item.customer_inclusion !== "no") {
      const alreadyAnswered = getClarificationAnswer(
        clarificationAnswers,
        `scope_item__${item.item_key}__detail`
      );

      if (!alreadyAnswered) {
        blueprints.push({
          question_key: `scope_item__${item.item_key}__detail`,
          question_text: `What specific details should contractors know about "${item.item_label}"?`,
          question_type: "text",
          help_text:
            "Quantities, dimensions, materials, access constraints, and finish expectations help contractors produce accurate bids.",
          placeholder:
            "Example: specific measurements, material preferences, access conditions, etc.",
          options_json: [],
        });
      }
    }

    return blueprints.map((blueprint, index) => {
      const answer = getClarificationAnswer(
        clarificationAnswers,
        blueprint.question_key
      );

      return {
        scope_item_key: item.item_key,
        question_key: blueprint.question_key,
        question_text: blueprint.question_text,
        question_type: blueprint.question_type,
        help_text: blueprint.help_text,
        placeholder: blueprint.placeholder,
        options_json: blueprint.options_json,
        answer_value_json: answer ?? null,
        status: hasMeaningfulAnswer(answer)
          ? ("answered" as const)
          : ("pending" as const),
        asked_by: "ai" as const,
        display_order: index,
        answered_at: hasMeaningfulAnswer(answer)
          ? new Date().toISOString()
          : null,
      };
    });
  });
}

export function applyItemClarificationStateToScopeItems(params: {
  items: ProjectAiScopeItemDraft[];
  clarifications: ProjectAiItemClarificationDraft[];
}): ProjectAiScopeItemDraft[] {
  const { items, clarifications } = params;
  const countsByItemKey = new Map<
    string,
    { total: number; pending: number }
  >();

  for (const clarification of clarifications) {
    const current = countsByItemKey.get(clarification.scope_item_key) || {
      total: 0,
      pending: 0,
    };

    current.total += 1;
    if (clarification.status !== "answered") {
      current.pending += 1;
    }

    countsByItemKey.set(clarification.scope_item_key, current);
  }

  return items.map((item) => {
    const counts = countsByItemKey.get(item.item_key);
    if (!counts) return item;

    // Update customer_inclusion from the include/exclude answer
    const inclusionAnswer = clarifications.find(
      (c) =>
        c.scope_item_key === item.item_key &&
        c.question_key === `scope_item__${item.item_key}__include` &&
        c.status === "answered" &&
        typeof c.answer_value_json === "string"
    );

    let customerInclusion = item.customer_inclusion;
    if (inclusionAnswer && typeof inclusionAnswer.answer_value_json === "string") {
      const val = inclusionAnswer.answer_value_json as string;
      if (val === "yes" || val === "no" || val === "not_sure") {
        customerInclusion = val;
      }
    }

    return {
      ...item,
      needs_clarification: counts.pending > 0,
      customer_inclusion: customerInclusion,
    };
  });
}

export function getProjectAiScopeItemPricingReasoning(
  item: Pick<
    ProjectAiScopeItem,
    | "item_label"
    | "source_method"
    | "estimated_low"
    | "estimated_high"
    | "confidence_level"
    | "needs_clarification"
    | "confidence_reason"
  >
) {
  const hasRange =
    item.estimated_low !== null && item.estimated_high !== null;

  if (item.source_method === "llm_generated" && hasRange) {
    return `This is a standard requirement identified by the AI for this project type. The initial range is directional and will tighten as you confirm scope details.`;
  }

  if (item.source_method === "historical_bids" && hasRange) {
    return `This range uses internal bid history for similar ${item.item_label.toLowerCase()} scopes.`;
  }

  if (item.source_method === "budget_signal" && hasRange) {
    return `This range is anchored by the customer's stated budget because direct pricing data is limited.`;
  }

  if (!hasRange && item.needs_clarification) {
    return "There is not enough pricing signal yet. Confirming this item and adding detail will help generate a range.";
  }

  return (
    item.confidence_reason ||
    "This line item is a directional signal and should be treated as preconstruction guidance."
  );
}
