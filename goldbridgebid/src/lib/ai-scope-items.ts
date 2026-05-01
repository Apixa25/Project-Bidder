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
import {
  findCraftsmanCostsForScopeItem,
  formatCraftsmanAsQuantityDrivers,
} from "@/lib/craftsman-lookup";
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

export type ProjectAiScopeItemCalcMode = "multiply" | "add";

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
  material_calc_mode: ProjectAiScopeItemCalcMode;
  labor_calc_mode: ProjectAiScopeItemCalcMode;
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

// Cost split ratios and budget-anchored pricing have been removed.
// Scope items are a checklist — pricing comes from contractor bids.

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
  wageEntry: TradeWageEntry;
  sector?: "residential" | "commercial" | "industrial" | "infrastructure" | "mixed";
}): ProjectAiScopeItemDraft {
  const { requirement, index, wageEntry, sector } = params;

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

  // Look up Craftsman reference costs for this scope item
  const craftsmanResults = findCraftsmanCostsForScopeItem({
    itemLabel: requirement.item_label,
    itemCategory: requirement.category,
    sector: sector || "residential",
    maxResults: 3,
  });

  if (craftsmanResults.length > 0) {
    console.log(
      `[scope-items] Craftsman match for "${requirement.item_label}": ${craftsmanResults.length} results (top: "${craftsmanResults[0].item.description}" $${craftsmanResults[0].item.total}/${craftsmanResults[0].item.unit})`
    );
  }

  if (craftsmanResults.length > 0) {
    const craftsmanDrivers = formatCraftsmanAsQuantityDrivers(craftsmanResults);
    quantityDrivers.push(...craftsmanDrivers);

    const topResult = craftsmanResults[0];
    const refItem = topResult.item;
    const costStr = refItem.total !== null
      ? `$${refItem.total}/${refItem.unit}`
      : refItem.material !== null
        ? `$${refItem.material}/${refItem.unit} (material only)`
        : "reference available";

    evidenceSignals.push({
      key: "craftsman_reference",
      label: "Craftsman 2023 reference cost",
      summary: `Published cost for "${refItem.description}": ${costStr}. Source: 2023 National Construction Estimator.`,
      strength: "supporting",
      source: "trade_history",
    });
  }

  const hasCustomerQuantity =
    requirement.customer_stated_quantity !== null &&
    requirement.customer_stated_quantity !== undefined;

  // Derive pricing from Craftsman reference costs
  let materialLow: number | null = null;
  let materialHigh: number | null = null;
  let laborLow: number | null = null;
  let laborHigh: number | null = null;
  let equipmentLow: number | null = null;
  let equipmentHigh: number | null = null;
  let estimatedLow: number | null = null;
  let estimatedHigh: number | null = null;
  let craftsmanUnit: string | null = null;

  if (craftsmanResults.length > 0) {
    const topMatch = craftsmanResults[0].item;
    craftsmanUnit = topMatch.unit;
    const qty = hasCustomerQuantity ? (requirement.customer_stated_quantity ?? 1) : 1;

    if (topMatch.material !== null) {
      materialLow = Math.round(topMatch.material * qty * 0.85 * 100) / 100;
      materialHigh = Math.round(topMatch.material * qty * 1.15 * 100) / 100;
    }

    if (topMatch.labor !== null) {
      laborLow = Math.round(topMatch.labor * qty * 0.85 * 100) / 100;
      laborHigh = Math.round(topMatch.labor * qty * 1.15 * 100) / 100;
    } else if (topMatch.manhours !== null) {
      const laborCost = topMatch.manhours * wageEntry.hourly_rate * qty;
      laborLow = Math.round(laborCost * 0.85 * 100) / 100;
      laborHigh = Math.round(laborCost * 1.15 * 100) / 100;
    }

    if (topMatch.equipment !== null) {
      equipmentLow = Math.round(topMatch.equipment * qty * 0.85 * 100) / 100;
      equipmentHigh = Math.round(topMatch.equipment * qty * 1.15 * 100) / 100;
    }

    estimatedLow = (materialLow ?? 0) + (laborLow ?? 0) + (equipmentLow ?? 0);
    estimatedHigh = (materialHigh ?? 0) + (laborHigh ?? 0) + (equipmentHigh ?? 0);

    if (estimatedLow === 0 && estimatedHigh === 0) {
      estimatedLow = null;
      estimatedHigh = null;
    }

    if (craftsmanUnit) {
      quantityDrivers.push({
        key: "craftsman_unit",
        label: "Craftsman pricing unit",
        value: `Per ${craftsmanUnit}${hasCustomerQuantity ? ` × ${requirement.customer_stated_quantity}` : ""}`,
        unit: craftsmanUnit,
        confidence: "medium",
        source: "trade_history",
      });
    }
  }

  const assumptions = hasCustomerQuantity
    ? [
        `Customer stated ${requirement.customer_stated_quantity} ${requirement.customer_stated_unit || "units"}.`,
        `This item is listed as ${requirement.recommended_inclusion} for this project type.`,
      ]
    : [
        `This item is listed as ${requirement.recommended_inclusion} for this project type.`,
      ];

  if (craftsmanResults.length > 0) {
    assumptions.push(
      "Unit cost references from 2023 National Construction Estimator (Craftsman). Actual costs vary by location and conditions."
    );
    if (estimatedLow !== null) {
      assumptions.push(
        `Pricing range reflects ±15% of published unit cost${hasCustomerQuantity ? ` multiplied by customer quantity (${requirement.customer_stated_quantity})` : " (qty=1, adjust when quantity is known)"}.`
      );
    }
  }

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
    estimated_low: estimatedLow,
    estimated_high: estimatedHigh,
    labor_low: laborLow,
    labor_high: laborHigh,
    material_low: materialLow,
    material_high: materialHigh,
    equipment_low: equipmentLow,
    equipment_high: equipmentHigh,
    quantity_drivers_json: quantityDrivers,
    evidence_signals_json: evidenceSignals,
    assumptions_json: assumptions,
    exclusions_json: [
      "Final pricing depends on site conditions, contractor availability, and material selections.",
    ],
    source_method: craftsmanResults.length > 0 ? "ai_assembly" : "llm_generated",
    needs_clarification: !requirement.is_mentioned_by_customer && !hasCustomerQuantity,
    customer_inclusion: requirement.is_mentioned_by_customer ? "yes" : null,
    material_calc_mode: "multiply",
    labor_calc_mode: "multiply",
    display_order: index,
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
        material_calc_mode: "multiply",
        labor_calc_mode: "multiply",
        display_order: 0,
      },
    ];
  }

  // Build scope items from LLM classification requirements.
  // Each item gets Craftsman reference costs attached as quantity drivers
  // so users see real published unit costs from an authoritative source.
  const requirements = classification.standard_requirements;
  const sector = classification.project_classification.construction_sector;

  return requirements.map((requirement, index) =>
    buildScopeItemFromRequirement({
      requirement,
      index,
      wageEntry,
      sector,
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
    const inclusionQuestionKey = `scope_item__${item.item_key}__include`;
    const inclusionAnswer = getClarificationAnswer(
      clarificationAnswers,
      inclusionQuestionKey
    );
    const blueprints: Array<{
      question_key: string;
      question_text: string;
      question_type: ProjectAiClarificationQuestionType;
      help_text: string | null;
      placeholder: string | null;
      options_json: Array<Record<string, unknown>>;
    }> = [];

    // If the customer hasn't confirmed this item, ask if they want to include it
    if (item.customer_inclusion === null || inclusionAnswer) {
      blueprints.push({
        question_key: inclusionQuestionKey,
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

