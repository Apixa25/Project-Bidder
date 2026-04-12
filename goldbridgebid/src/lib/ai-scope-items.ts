import type {
  ProjectAiAnalysisInput,
  ProjectAiAnalysisResult,
  ProjectAiClarificationAnswerInput,
  ProjectAiClarificationQuestionType,
  ProjectAiTradeBreakdownItem,
} from "@/lib/ai-estimates";
import { getMaxTradeWage, getWageForExpertiseLevel, type TradeWageEntry } from "@/lib/trade-wages";
import { TRADE_LABELS, type TradeCategory } from "@/types/database";

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
  | "manual_review";

export type ProjectAiScopeItemCategory =
  | "site_prep"
  | "utility"
  | "electrical"
  | "water"
  | "sewer"
  | "grading"
  | "drainage"
  | "foundation"
  | "delivery"
  | "permit"
  | "finish"
  | "demolition"
  | "landscape"
  | "other";

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

function normalizeText(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function hasMeaningfulAnswer(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulAnswer(item));
  }

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

function buildScopeItemQuestionKey(itemKey: string, suffix: string) {
  return `scope_item__${itemKey}__${suffix}`;
}

function buildOption(id: string, label: string) {
  return { id, label } as Record<string, unknown>;
}

function buildQuantityDriver(
  key: string,
  label: string,
  value: string,
  options?: {
    unit?: string | null;
    confidence?: ProjectAiScopeItemConfidenceLevel;
    source?: ProjectAiScopeItemQuantityDriver["source"];
  }
): ProjectAiScopeItemQuantityDriver {
  return {
    key,
    label,
    value,
    unit: options?.unit ?? null,
    confidence: options?.confidence ?? "medium",
    source: options?.source ?? "ai_inference",
  };
}

function buildEvidenceSignal(
  key: string,
  label: string,
  summary: string,
  options?: {
    strength?: ProjectAiScopeItemEvidenceSignal["strength"];
    source?: ProjectAiScopeItemEvidenceSignal["source"];
    matched_files?: string[];
    matched_signals?: string[];
    matched_excerpts?: string[];
    verification_gap?: string | null;
    recommended_uploads?: string[];
  }
): ProjectAiScopeItemEvidenceSignal {
  return {
    key,
    label,
    summary,
    strength: options?.strength ?? "supporting",
    source: options?.source ?? "ai_inference",
    matched_files: options?.matched_files,
    matched_signals: options?.matched_signals,
    matched_excerpts: options?.matched_excerpts,
    verification_gap: options?.verification_gap ?? null,
    recommended_uploads: options?.recommended_uploads,
  };
}

function mapTradeToCategory(trade: string): ProjectAiScopeItemCategory {
  const normalized = trade.toLowerCase();

  if (
    normalized.includes("electrical") ||
    normalized.includes("low_voltage") ||
    normalized.includes("solar")
  ) {
    return "electrical";
  }

  if (
    normalized.includes("plumbing") ||
    normalized.includes("water") ||
    normalized.includes("sanitation")
  ) {
    return "water";
  }

  if (
    normalized.includes("sewer") ||
    normalized.includes("pipeline")
  ) {
    return "sewer";
  }

  if (
    normalized.includes("grading") ||
    normalized.includes("earthwork") ||
    normalized.includes("concrete") ||
    normalized.includes("masonry")
  ) {
    return "site_prep";
  }

  if (normalized.includes("demolition")) {
    return "demolition";
  }

  if (normalized.includes("landscape") || normalized.includes("fence")) {
    return "landscape";
  }

  return "other";
}

function mapTradeBreakdownSource(
  source: ProjectAiTradeBreakdownItem["source"]
): ProjectAiScopeItemSourceMethod {
  if (source === "historical_bids") {
    return "historical_bids";
  }

  if (source === "budget_signal") {
    return "budget_signal";
  }

  return "insufficient_signal";
}

function pushUniqueItem(
  items: ProjectAiScopeItemDraft[],
  item: ProjectAiScopeItemDraft
) {
  if (items.some((existing) => existing.item_key === item.item_key)) {
    return;
  }

  items.push({
    ...item,
    display_order: items.length,
  });
}

interface PricingRange {
  low: number;
  high: number;
}

function roundCurrency(value: number) {
  return Math.round(value / 50) * 50;
}

function normalizeRange(range: PricingRange): PricingRange {
  const low = Math.max(0, Math.min(range.low, range.high));
  const high = Math.max(low, Math.max(range.low, range.high));

  return {
    low: roundCurrency(low),
    high: roundCurrency(high),
  };
}

function tightenRange(range: PricingRange, factor: number) {
  const center = (range.low + range.high) / 2;
  const halfWidth = ((range.high - range.low) / 2) * factor;

  return normalizeRange({
    low: center - halfWidth,
    high: center + halfWidth,
  });
}

function scaleRange(range: PricingRange, factor: number) {
  return normalizeRange({
    low: range.low * factor,
    high: range.high * factor,
  });
}

function createRange(low: number, high: number) {
  return normalizeRange({ low, high });
}

function getBudgetMidpoint(input: ProjectAiAnalysisInput) {
  if (input.budgetMin && input.budgetMax) {
    return (input.budgetMin + input.budgetMax) / 2;
  }

  if (input.budgetMin) {
    return input.budgetMin;
  }

  if (input.budgetMax) {
    return input.budgetMax;
  }

  return null;
}

function getBudgetAnchoredRange(
  input: ProjectAiAnalysisInput,
  share: number,
  fallback: PricingRange
) {
  const budgetMidpoint = getBudgetMidpoint(input);
  if (!budgetMidpoint) {
    return fallback;
  }

  return createRange(
    budgetMidpoint * share * 0.8,
    budgetMidpoint * share * 1.25
  );
}

function getTradeAnchoredRange(
  analysis: ProjectAiAnalysisResult,
  keywords: string[]
): PricingRange | null {
  const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());

  const match = analysis.trade_breakdown.find((tradeItem) => {
    const haystack = `${tradeItem.trade} ${tradeItem.label}`.toLowerCase();
    return (
      tradeItem.estimated_low !== null &&
      tradeItem.estimated_high !== null &&
      loweredKeywords.some((keyword) => haystack.includes(keyword))
    );
  });

  if (!match || match.estimated_low === null || match.estimated_high === null) {
    return null;
  }

  return createRange(match.estimated_low, match.estimated_high);
}

function getScopeItemAnswer(
  answers: ProjectAiClarificationAnswerInput[],
  itemKey: string,
  suffix: string
) {
  return getClarificationAnswer(
    answers,
    buildScopeItemQuestionKey(itemKey, suffix)
  );
}

function getAnswerText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .join(", ")
      .trim();
  }

  return "";
}

function extractFeetEstimate(text: string) {
  const match = text.match(/(\d{1,4})\s*(?:ft|feet|foot)/i);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1] || "", 10);
  return Number.isFinite(value) ? value : null;
}

function extractDimensionPair(text: string) {
  const match = text.match(/(\d{1,4})\s*(?:ft|feet|foot)?\s*[xX]\s*(\d{1,4})\s*(?:ft|feet|foot)?/i);
  if (!match) {
    return null;
  }

  const width = Number.parseInt(match[1] || "", 10);
  const length = Number.parseInt(match[2] || "", 10);
  if (!Number.isFinite(width) || !Number.isFinite(length)) {
    return null;
  }

  return { width, length };
}

function textSuggestsComplexity(text: string) {
  return /(crane|overhead|tight|narrow|soft|slope|steep|limited|gate|obstruction|turnaround)/i.test(
    text
  );
}

interface ExtractedQuantity {
  value: number;
  unit: string;
  label: string;
  raw: string;
}

/**
 * Extracts explicit quantities from project description text.
 * Matches patterns like "250 ft of trench", "3 loads of gravel",
 * "40 x 60 pad", "200 linear feet", etc.
 */
function extractDescriptionQuantities(text: string): ExtractedQuantity[] {
  const quantities: ExtractedQuantity[] = [];
  const normalized = text.toLowerCase();

  const patterns: Array<{
    regex: RegExp;
    buildResult: (match: RegExpMatchArray) => ExtractedQuantity | null;
  }> = [
    {
      regex: /(\d{1,6})\s*(?:linear\s+)?(?:ft|feet|foot)\s+(?:of\s+)?(\w[\w\s]{1,30})/gi,
      buildResult: (m) => ({
        value: Number(m[1]),
        unit: "ft",
        label: (m[2] || "").trim(),
        raw: m[0].trim(),
      }),
    },
    {
      regex: /(\d{1,6})\s*(?:sq\.?\s*ft|square\s+feet)\s+(?:of\s+)?(\w[\w\s]{1,30})?/gi,
      buildResult: (m) => ({
        value: Number(m[1]),
        unit: "sq ft",
        label: (m[2] || "area").trim(),
        raw: m[0].trim(),
      }),
    },
    {
      regex: /(\d{1,6})\s*(?:cubic\s+)?(?:yards?|yds?)\s+(?:of\s+)?(\w[\w\s]{1,30})?/gi,
      buildResult: (m) => ({
        value: Number(m[1]),
        unit: "cu yd",
        label: (m[2] || "material").trim(),
        raw: m[0].trim(),
      }),
    },
    {
      regex: /(\d{1,4})\s*(?:loads?)\s+(?:of\s+)?(\w[\w\s]{1,30})?/gi,
      buildResult: (m) => ({
        value: Number(m[1]),
        unit: "loads",
        label: (m[2] || "material").trim(),
        raw: m[0].trim(),
      }),
    },
    {
      regex: /(\d{1,4})\s*(?:ft|feet|foot)\s*[xX×]\s*(\d{1,4})\s*(?:ft|feet|foot)?/gi,
      buildResult: (m) => ({
        value: Number(m[1]) * Number(m[2]),
        unit: "sq ft",
        label: `${m[1]} × ${m[2]} ft area`,
        raw: m[0].trim(),
      }),
    },
  ];

  for (const { regex, buildResult } of patterns) {
    for (const match of normalized.matchAll(regex)) {
      const result = buildResult(match);
      if (result && Number.isFinite(result.value) && result.value > 0) {
        quantities.push(result);
      }
    }
  }

  const seen = new Set<string>();
  return quantities.filter((q) => {
    const key = `${q.value}-${q.unit}-${q.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function textSuggestsSimpleAccess(text: string) {
  return /(open|clear|flat|easy|no issues|no known issues|good access)/i.test(text);
}

function getItemCostSplitRatios(item: ProjectAiScopeItemDraft) {
  switch (item.item_category) {
    case "electrical":
      return { labor: 0.55, material: 0.35, equipment: 0.1 };
    case "foundation":
      return { labor: 0.35, material: 0.5, equipment: 0.15 };
    case "grading":
    case "site_prep":
      return { labor: 0.4, material: 0.35, equipment: 0.25 };
    case "utility":
    case "water":
    case "sewer":
      return { labor: 0.5, material: 0.35, equipment: 0.15 };
    case "delivery":
      return { labor: 0.35, material: 0.05, equipment: 0.6 };
    case "permit":
      return { labor: 0.9, material: 0.05, equipment: 0.05 };
    default:
      return { labor: 0.55, material: 0.3, equipment: 0.15 };
  }
}

function applyCostSplits(
  item: ProjectAiScopeItemDraft,
  range: PricingRange | null,
  wageEntry: TradeWageEntry | null
): ProjectAiScopeItemDraft {
  if (!range) {
    return {
      ...item,
      labor_low: null,
      labor_high: null,
      material_low: null,
      material_high: null,
      equipment_low: null,
      equipment_high: null,
    };
  }

  const ratios = getItemCostSplitRatios(item);

  if (wageEntry && wageEntry.hourly_rate > 0) {
    // Derive labor hours from the total range and category ratio, then
    // recalculate labor cost as hours × hourly_rate. This makes the
    // wage sheet the explicit input rather than an opaque ratio.
    const laborShareLow = range.low * ratios.labor;
    const laborShareHigh = range.high * ratios.labor;
    const hoursLow = Math.round(laborShareLow / wageEntry.hourly_rate);
    const hoursHigh = Math.round(laborShareHigh / wageEntry.hourly_rate);

    return {
      ...item,
      labor_low: roundCurrency(hoursLow * wageEntry.hourly_rate),
      labor_high: roundCurrency(hoursHigh * wageEntry.hourly_rate),
      material_low: roundCurrency(range.low * ratios.material),
      material_high: roundCurrency(range.high * ratios.material),
      equipment_low: roundCurrency(range.low * ratios.equipment),
      equipment_high: roundCurrency(range.high * ratios.equipment),
    };
  }

  return {
    ...item,
    labor_low: roundCurrency(range.low * ratios.labor),
    labor_high: roundCurrency(range.high * ratios.labor),
    material_low: roundCurrency(range.low * ratios.material),
    material_high: roundCurrency(range.high * ratios.material),
    equipment_low: roundCurrency(range.low * ratios.equipment),
    equipment_high: roundCurrency(range.high * ratios.equipment),
  };
}

function getNextConfidenceLevel(
  current: ProjectAiScopeItemConfidenceLevel,
  direction: "up" | "down"
): ProjectAiScopeItemConfidenceLevel {
  const order: ProjectAiScopeItemConfidenceLevel[] = ["low", "medium", "high"];
  const index = order.indexOf(current);

  if (direction === "up") {
    return order[Math.min(order.length - 1, index + 1)];
  }

  return order[Math.max(0, index - 1)];
}

function getScopeItemAnswerStats(
  item: ProjectAiScopeItemDraft,
  input: ProjectAiAnalysisInput
) {
  const blueprints = getScopeItemClarificationBlueprints(item, input);
  const clarificationAnswers = input.clarificationAnswers || [];
  const answeredCount = blueprints.filter((blueprint) =>
    hasMeaningfulAnswer(
      getClarificationAnswer(clarificationAnswers, blueprint.question_key)
    )
  ).length;

  return {
    total: blueprints.length,
    answered: answeredCount,
  };
}

function buildScopeItemUploadRequestBlueprints(
  item: ProjectAiScopeItemDraft,
  input: ProjectAiAnalysisInput
) {
  const coverage = getScopeItemUploadCoverage(item, input);
  const requests: Array<{
    question_key: string;
    question_text: string;
    question_type: "upload_request";
    help_text: string;
    placeholder: string | null;
    options_json: Array<Record<string, unknown>>;
  }> = [];

  const needsVisualCoverage = [
    "modular_site_prep",
    "modular_delivery_set_logistics",
    "grading_and_drainage",
    "site_access_logistics",
    "utility_tie_in_verification",
  ].includes(item.item_key);

  const needsTechnicalDocumentation = [
    "electrical_service_upgrade",
    "modular_foundation_support",
    "permit_and_inspection_coordination",
  ].includes(item.item_key);

  if (needsVisualCoverage && !coverage.hasRelevantVisualEvidence) {
    requests.push({
      question_key: buildScopeItemQuestionKey(item.item_key, "upload_visual_evidence"),
      question_text: `Upload site photos or a short walkaround video for ${item.item_label.toLowerCase()}.`,
      question_type: "upload_request",
      help_text:
        coverage.hasAnyVisualEvidence
          ? "The project already has some visual uploads, but none of them appear clearly tied to this item yet. Add item-specific photos or video so the estimator can connect the evidence to this scope."
          : "The estimator can reason more confidently when it has visual context for access, grading, pad condition, utility locations, or delivery constraints.",
      placeholder: null,
      options_json: [],
    });
  }

  if (needsTechnicalDocumentation && !coverage.hasRelevantDocumentEvidence) {
    requests.push({
      question_key: buildScopeItemQuestionKey(item.item_key, "upload_supporting_documents"),
      question_text: `Upload any plans, permits, sketches, or utility paperwork related to ${item.item_label.toLowerCase()}.`,
      question_type: "upload_request",
      help_text:
        coverage.hasAnyDocumentEvidence
          ? "The project already has document uploads, but none of the filenames clearly map to this item yet. Add a more item-specific plan, permit, sketch, or utility document if available."
          : "Technical documents can tighten the AI planning range by reducing uncertainty around code, sizing, layout, or approval requirements.",
      placeholder: null,
      options_json: [],
    });
  }

  if (
    item.item_key === "electrical_service_upgrade" &&
    coverage.relevantPhotoFiles.length === 0
  ) {
    requests.push({
      question_key: buildScopeItemQuestionKey(item.item_key, "upload_electrical_photos"),
      question_text: "Upload photos of the existing panel, meter area, and proposed hookup path if available.",
      question_type: "upload_request",
      help_text:
        coverage.hasAnyVisualEvidence
          ? "The estimator still does not see panel- or hookup-specific visual evidence for this item. Panel, meter, and path photos are especially useful here."
          : "Panel and path photos help the estimator judge access, routing complexity, and whether the current electrical setup appears simple or constrained.",
      placeholder: null,
      options_json: [],
    });
  }

  return requests;
}

function buildDefaultItemExclusions(item: ProjectAiScopeItemDraft) {
  const exclusions = [
    "Final contractor markup, permit fees, and tax treatment may vary by bidder.",
  ];

  switch (item.item_category) {
    case "site_prep":
    case "grading":
      exclusions.push(
        "Does not assume major retaining walls, rock excavation, or unexpected geotechnical remediation unless later confirmed."
      );
      break;
    case "electrical":
      exclusions.push(
        "Does not assume utility-company service changes, transformer work, or hidden panel deficiencies unless later confirmed."
      );
      break;
    case "utility":
    case "water":
    case "sewer":
      exclusions.push(
        "Does not assume off-site utility main work or undiscovered code correction beyond the visible tie-in area."
      );
      break;
    case "delivery":
      exclusions.push(
        "Does not assume unusual escort, road closure, or specialty lift coordination unless later confirmed."
      );
      break;
    case "permit":
      exclusions.push(
        "Does not include jurisdiction-specific fee schedules that have not yet been verified."
      );
      break;
    default:
      exclusions.push(
        "Does not include hidden existing-condition repairs that are not yet described in the current scope."
      );
      break;
  }

  return exclusions;
}

function buildItemAssumptionsAndExclusions(params: {
  item: ProjectAiScopeItemDraft;
  input: ProjectAiAnalysisInput;
  range: PricingRange | null;
}) {
  const { item, input, range } = params;
  const clarificationAnswers = input.clarificationAnswers || [];
  const assumptions = [
    range
      ? `Directional range assumes the current project scope for ${item.item_label.toLowerCase()} stays materially similar to what is described today.`
      : `This item is still being treated as a probable scope item and not a fully priced line item yet.`,
  ];
  const exclusions = buildDefaultItemExclusions(item);

  if (item.item_key === "modular_site_prep") {
    const padCondition = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "existing_pad_condition")
    );

    if (padCondition === "bare_dirt") {
      assumptions.push(
        "Assumes at least some new base preparation, grading, or compaction work is likely required."
      );
    }

    if (padCondition === "existing_gravel") {
      assumptions.push(
        "Assumes some portion of the existing gravel/base can likely be reused with limited correction."
      );
    }

    if (padCondition === "concrete_pad") {
      assumptions.push(
        "Assumes an existing slab or hardened pad may reduce the amount of new prep work required."
      );
    }
  }

  if (item.item_key === "electrical_service_upgrade") {
    const serviceSize = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "target_service_size")
    );
    const distanceNotes = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "electrical_distance_notes")
    );

    if (serviceSize) {
      assumptions.push(`Assumes the target service requirement is approximately ${serviceSize.replaceAll("_", " ")}.`);
    }

    if (distanceNotes) {
      assumptions.push(
        "Assumes the described electrical run distance and routing notes are directionally accurate."
      );
    } else {
      exclusions.push(
        "Directional pricing does not yet lock in trench length or final feeder routing."
      );
    }
  }

  if (item.item_key === "utility_tie_in_verification") {
    const utilitiesReady = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "existing_utilities_ready")
    );

    if (utilitiesReady === "yes_aligned") {
      assumptions.push(
        "Assumes most existing utility stubs are already near the final home placement."
      );
    }

    if (utilitiesReady === "no_relocation_likely") {
      assumptions.push(
        "Assumes utility relocation or extension work is likely part of the final scope."
      );
    }
  }

  if (item.item_key === "permit_and_inspection_coordination") {
    const permitExpectation = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "permit_expectation")
    );

    if (permitExpectation === "customer") {
      assumptions.push(
        "Assumes the customer will absorb much of the permit-running responsibility."
      );
    }

    if (permitExpectation === "contractor") {
      assumptions.push(
        "Assumes the contractor is expected to coordinate filings, scheduling, and inspection logistics."
      );
    }
  }

  if (item.item_key === "site_access_logistics") {
    const accessNotes = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "site_access_constraints")
    );

    if (accessNotes) {
      assumptions.push(
        "Assumes the described site access and staging constraints are materially representative."
      );
    } else {
      exclusions.push(
        "Does not include severe access penalties that have not yet been confirmed in writing or photos."
      );
    }
  }

  if (item.item_key === "unified_project_package" || item.item_key.startsWith("trade_package_")) {
    const scopeDetail = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "scope_detail")
    );

    if (scopeDetail) {
      assumptions.push(
        "Assumes the added scope notes are materially accurate and complete enough for a tighter planning range."
      );
    }
  }

  return {
    assumptions: Array.from(new Set(assumptions)),
    exclusions: Array.from(new Set(exclusions)),
  };
}

function buildItemQuantityDrivers(params: {
  item: ProjectAiScopeItemDraft;
  input: ProjectAiAnalysisInput;
  analysis: ProjectAiAnalysisResult;
  range: PricingRange | null;
  wageEntry: TradeWageEntry | null;
  llmLaborHourEstimate?: { total_hours_low: number; total_hours_high: number; reasoning: string } | null;
}): ProjectAiScopeItemQuantityDriver[] {
  const { item, input, analysis, range, wageEntry, llmLaborHourEstimate } = params;
  const clarificationAnswers = input.clarificationAnswers || [];
  const drivers: ProjectAiScopeItemQuantityDriver[] = [];

  if (range) {
    drivers.push(
      buildQuantityDriver(
        "planning_range_midpoint",
        "Planning midpoint",
        formatCurrencyValue(Math.round((range.low + range.high) / 2)),
        {
          confidence: item.confidence_level,
          source:
            item.source_method === "historical_bids"
              ? "trade_history"
              : item.source_method === "budget_signal"
                ? "budget_signal"
                : "ai_inference",
        }
      )
    );
  }

  if (wageEntry && wageEntry.hourly_rate > 0) {
    drivers.push(
      buildQuantityDriver(
        "labor_hourly_rate",
        "Labor rate",
        `$${wageEntry.hourly_rate}/hr (${wageEntry.role_label})`,
        { unit: "$/hr", confidence: "high", source: "trade_history" }
      )
    );

    if (llmLaborHourEstimate) {
      const hoursLow = llmLaborHourEstimate.total_hours_low;
      const hoursHigh = llmLaborHourEstimate.total_hours_high;

      drivers.push(
        buildQuantityDriver(
          "estimated_labor_hours",
          "Estimated labor hours (AI)",
          hoursLow === hoursHigh ? String(hoursLow) : `${hoursLow} – ${hoursHigh}`,
          { unit: "hrs", confidence: "medium", source: "ai_inference" }
        )
      );

      drivers.push(
        buildQuantityDriver(
          "labor_cost_calculation",
          "Labor cost (hrs × rate)",
          `${hoursLow === hoursHigh ? hoursLow : `${hoursLow}–${hoursHigh}`} hrs × $${wageEntry.hourly_rate}/hr = ${formatCurrencyValue(hoursLow * wageEntry.hourly_rate)} – ${formatCurrencyValue(hoursHigh * wageEntry.hourly_rate)}`,
          { confidence: "medium", source: "ai_inference" }
        )
      );
    } else if (range) {
      const ratios = getItemCostSplitRatios(item);
      const hoursLow = Math.round((range.low * ratios.labor) / wageEntry.hourly_rate);
      const hoursHigh = Math.round((range.high * ratios.labor) / wageEntry.hourly_rate);

      drivers.push(
        buildQuantityDriver(
          "estimated_labor_hours",
          "Estimated labor hours (derived)",
          hoursLow === hoursHigh ? String(hoursLow) : `${hoursLow} – ${hoursHigh}`,
          { unit: "hrs", confidence: item.confidence_level, source: "ai_inference" }
        )
      );

      drivers.push(
        buildQuantityDriver(
          "labor_cost_calculation",
          "Labor cost (hrs × rate)",
          `${hoursLow === hoursHigh ? hoursLow : `${hoursLow}–${hoursHigh}`} hrs × $${wageEntry.hourly_rate}/hr`,
          { confidence: item.confidence_level, source: "ai_inference" }
        )
      );
    }
  }

  if (item.item_key === "unified_project_package") {
    const descriptionText = [
      input.title,
      input.description,
      input.completionCriteria,
    ].filter(Boolean).join(" ");

    const extractedQuantities = extractDescriptionQuantities(descriptionText);
    for (const eq of extractedQuantities.slice(0, 6)) {
      drivers.push(
        buildQuantityDriver(
          `desc_qty_${eq.label.replace(/\s+/g, "_").slice(0, 30)}`,
          eq.label.charAt(0).toUpperCase() + eq.label.slice(1),
          `${eq.value.toLocaleString()}`,
          { unit: eq.unit, confidence: "high", source: "project_text" }
        )
      );
    }
  }

  if (item.item_key === "modular_site_prep") {
    const padCondition = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "existing_pad_condition")
    );
    const notes = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "pad_size_or_notes")
    );
    const dimensions = extractDimensionPair(notes);

    if (padCondition) {
      drivers.push(
        buildQuantityDriver(
          "pad_condition",
          "Pad condition",
          padCondition.replaceAll("_", " "),
          { confidence: "high", source: "item_answer" }
        )
      );
    }

    if (dimensions) {
      drivers.push(
        buildQuantityDriver(
          "pad_width",
          "Pad width",
          String(dimensions.width),
          { unit: "ft", confidence: "high", source: "item_answer" }
        )
      );
      drivers.push(
        buildQuantityDriver(
          "pad_length",
          "Pad length",
          String(dimensions.length),
          { unit: "ft", confidence: "high", source: "item_answer" }
        )
      );
      drivers.push(
        buildQuantityDriver(
          "estimated_pad_area",
          "Estimated pad area",
          String(dimensions.width * dimensions.length),
          { unit: "sq ft", confidence: "medium", source: "item_answer" }
        )
      );
    }
  }

  if (item.item_key === "electrical_service_upgrade") {
    const serviceSize = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "target_service_size")
    );
    const distanceNotes = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "electrical_distance_notes")
    );
    const feet = extractFeetEstimate(distanceNotes);

    if (serviceSize) {
      const amps = serviceSize.replace("_amp", "");
      drivers.push(
        buildQuantityDriver("target_service", "Target service", amps, {
          unit: "amp",
          confidence: "high",
          source: "item_answer",
        })
      );
    }

    if (feet !== null) {
      drivers.push(
        buildQuantityDriver("run_length", "Estimated run length", String(feet), {
          unit: "ft",
          confidence: "medium",
          source: "item_answer",
        })
      );
    }
  }

  if (item.item_key === "utility_tie_in_verification") {
    const utilitiesReady = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "existing_utilities_ready")
    );

    if (utilitiesReady) {
      drivers.push(
        buildQuantityDriver(
          "utility_alignment",
          "Utility alignment",
          utilitiesReady.replaceAll("_", " "),
          { confidence: "high", source: "item_answer" }
        )
      );
    }
  }

  if (item.item_key === "grading_and_drainage") {
    const gradingCondition = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "grading_condition")
    );

    if (gradingCondition) {
      drivers.push(
        buildQuantityDriver(
          "site_condition",
          "Site condition",
          gradingCondition.replaceAll("_", " "),
          { confidence: "high", source: "item_answer" }
        )
      );
    }
  }

  if (item.item_key === "permit_and_inspection_coordination") {
    const permitExpectation = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "permit_expectation")
    );

    if (permitExpectation) {
      drivers.push(
        buildQuantityDriver(
          "permit_responsibility",
          "Permit responsibility",
          permitExpectation.replaceAll("_", " "),
          { confidence: "high", source: "item_answer" }
        )
      );
    }
  }

  if (item.item_key === "site_access_logistics") {
    const accessNotes = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "site_access_constraints")
    );

    if (accessNotes) {
      drivers.push(
        buildQuantityDriver(
          "access_complexity",
          "Access complexity",
          textSuggestsComplexity(accessNotes)
            ? "complex"
            : textSuggestsSimpleAccess(accessNotes)
              ? "simple"
              : "mixed or unknown",
          { confidence: "medium", source: "item_answer" }
        )
      );
    }
  }

  if (item.item_key === "modular_delivery_set_logistics") {
    const notes = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "delivery_access_notes")
    );

    if (notes) {
      drivers.push(
        buildQuantityDriver(
          "delivery_access_profile",
          "Delivery access profile",
          textSuggestsComplexity(notes)
            ? "restricted or complex"
            : textSuggestsSimpleAccess(notes)
              ? "open or straightforward"
              : "not fully defined",
          { confidence: "medium", source: "item_answer" }
        )
      );
    }
  }

  if (item.item_key === "unified_project_package" || item.item_key.startsWith("trade_package_")) {
    const totalBenchmarks = analysis.trade_breakdown.reduce(
      (sum, t) => sum + t.benchmark_count, 0
    );

    drivers.push(
      buildQuantityDriver(
        "benchmark_count",
        "Benchmark count",
        String(totalBenchmarks),
        {
          confidence: totalBenchmarks >= 3 ? "high" : "medium",
          source: "trade_history",
        }
      )
    );
  }

  const budgetMidpoint = getBudgetMidpoint(input);
  if (budgetMidpoint && item.source_method === "budget_signal") {
    drivers.push(
      buildQuantityDriver(
        "customer_budget_midpoint",
        "Customer budget midpoint",
        formatCurrencyValue(Math.round(budgetMidpoint)),
        { confidence: "medium", source: "budget_signal" }
      )
    );
  }

  return drivers;
}

function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getFileSignalCounts(files: ProjectAiAnalysisInput["files"]) {
  const counts = {
    imageCount: 0,
    videoCount: 0,
    documentCount: 0,
  };

  for (const file of files || []) {
    const type = (file.file_type || "").toLowerCase();
    const name = (file.file_name || "").toLowerCase();

    if (
      type.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(name)
    ) {
      counts.imageCount += 1;
      continue;
    }

    if (
      type.startsWith("video/") ||
      /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(name)
    ) {
      counts.videoCount += 1;
      continue;
    }

    if (type || name) {
      counts.documentCount += 1;
    }
  }

  return counts;
}

type ProjectAiScopeItemFileKind = "image" | "video" | "document";
type ProjectAiUploadedFileSignal = NonNullable<ProjectAiAnalysisInput["files"]>[number];

interface ProjectAiScopeItemFileMatch {
  fileName: string;
  fileKind: ProjectAiScopeItemFileKind;
  matchedKeywords: string[];
  matchedTags: string[];
  extractionSummary: string | null;
  extractionHints: string[];
  extractionEntities: string[];
  extractionNextStep: string | null;
  extractionExcerpt: string | null;
}

interface ProjectAiScopeItemUploadCoverage {
  hasRelevantVisualEvidence: boolean;
  hasRelevantDocumentEvidence: boolean;
  hasAnyVisualEvidence: boolean;
  hasAnyDocumentEvidence: boolean;
  relevantPhotoFiles: ProjectAiScopeItemFileMatch[];
  relevantVideoFiles: ProjectAiScopeItemFileMatch[];
  relevantDocumentFiles: ProjectAiScopeItemFileMatch[];
  recommendedUploads: string[];
}

function inferProjectFileKind(file: ProjectAiUploadedFileSignal) {
  if (file.file_kind) {
    return file.file_kind;
  }

  const type = (file?.file_type || "").toLowerCase();
  const name = (file?.file_name || "").toLowerCase();

  if (
    type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(name)
  ) {
    return "image" as const;
  }

  if (
    type.startsWith("video/") ||
    /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(name)
  ) {
    return "video" as const;
  }

  return "document" as const;
}

function getScopeItemFileKeywords(item: ProjectAiScopeItemDraft) {
  const baseKeywordsByItemKey: Record<string, string[]> = {
    modular_site_prep: [
      "site",
      "pad",
      "prep",
      "gravel",
      "grade",
      "grading",
      "base",
      "footprint",
      "layout",
    ],
    modular_foundation_support: [
      "foundation",
      "pier",
      "anchor",
      "anchoring",
      "tie down",
      "engineering",
      "slab",
    ],
    modular_delivery_set_logistics: [
      "delivery",
      "set",
      "access",
      "route",
      "turn",
      "turning",
      "crane",
      "staging",
    ],
    electrical_service_upgrade: [
      "electrical",
      "panel",
      "meter",
      "service",
      "amp",
      "conduit",
      "trench",
      "hookup",
      "power",
    ],
    utility_tie_in_verification: [
      "utility",
      "water",
      "sewer",
      "septic",
      "plumbing",
      "stub",
      "tie in",
      "hookup",
      "connection",
    ],
    grading_and_drainage: [
      "grading",
      "grade",
      "drainage",
      "drain",
      "erosion",
      "gravel",
      "base",
      "slope",
      "runoff",
    ],
    permit_and_inspection_coordination: [
      "permit",
      "inspection",
      "approval",
      "code",
      "plan",
      "drawing",
      "site plan",
      "application",
    ],
    site_access_logistics: [
      "access",
      "gate",
      "driveway",
      "road",
      "staging",
      "turnaround",
      "entry",
      "path",
    ],
  };

  const categoryKeywords: Record<ProjectAiScopeItemCategory, string[]> = {
    site_prep: ["site", "prep", "pad", "base"],
    utility: ["utility", "hookup", "connection"],
    electrical: ["electrical", "panel", "meter", "service"],
    water: ["water", "plumbing", "utility"],
    sewer: ["sewer", "septic", "utility"],
    grading: ["grading", "drainage", "slope"],
    drainage: ["drainage", "runoff", "erosion"],
    foundation: ["foundation", "anchor", "pier"],
    delivery: ["delivery", "access", "staging"],
    permit: ["permit", "inspection", "plan"],
    finish: ["finish"],
    demolition: ["demo", "demolition"],
    landscape: ["landscape", "grading"],
    other: [],
  };

  const keywords = [
    ...(baseKeywordsByItemKey[item.item_key] || []),
    ...categoryKeywords[item.item_category],
  ];

  if (item.item_key === "unified_project_package") {
    keywords.push("project", "scope", "work", "estimate");
  } else if (item.item_key.startsWith("trade_package_")) {
    const tradeToken = item.item_key.replace("trade_package_", "").replaceAll("_", " ");
    keywords.push(tradeToken);
    keywords.push(...tradeToken.split(" ").filter(Boolean));
  }

  return Array.from(
    new Set(
      keywords
        .map((keyword) => keyword.trim().toLowerCase())
        .filter((keyword) => keyword.length >= 3)
    )
  );
}

function getScopeItemRelevantFiles(
  item: ProjectAiScopeItemDraft,
  input: ProjectAiAnalysisInput
) {
  const keywords = getScopeItemFileKeywords(item);
  const matches: ProjectAiScopeItemFileMatch[] = [];

  for (const file of input.files || []) {
    const fileName = (file.file_name || "").trim();
    if (!fileName) {
      continue;
    }

    const loweredFileName = fileName.toLowerCase();
    const matchedKeywords = keywords.filter((keyword) => loweredFileName.includes(keyword));
    const matchedTags = (file.derived_tags || []).filter((tag) =>
      keywords.some((keyword) => tag.includes(keyword) || keyword.includes(tag))
    );
    const itemKeyMatch = (file.likely_item_keys || []).includes(item.item_key);

    if (matchedKeywords.length === 0 && matchedTags.length === 0 && !itemKeyMatch) {
      continue;
    }

    matches.push({
      fileName,
      fileKind: inferProjectFileKind(file),
      matchedKeywords: itemKeyMatch
        ? Array.from(new Set([...matchedKeywords, item.item_key]))
        : matchedKeywords,
      matchedTags,
      extractionSummary: file.extraction_summary || null,
      extractionHints: file.extraction_result?.content_hints || [],
      extractionEntities:
        file.extraction_result?.entities.map((entity) => entity.label) || [],
      extractionNextStep: file.extraction_result?.recommended_next_step || null,
      extractionExcerpt: file.extraction_result?.excerpt || null,
    });
  }

  return matches;
}

function getScopeItemRecommendedUploads(item: ProjectAiScopeItemDraft) {
  const byItemKey: Record<string, string[]> = {
    modular_site_prep: [
      "Wide site overview photos",
      "Close-up photos of the pad/base condition",
      "A sketch or notes showing the intended footprint dimensions",
    ],
    modular_foundation_support: [
      "Foundation detail sketch or plan",
      "Photos of any existing slab, piers, or anchoring points",
      "Manufacturer setup or engineering document if available",
    ],
    modular_delivery_set_logistics: [
      "Drive access photos from street to set location",
      "A short walkaround video of the delivery path",
      "Photos of gates, overhead lines, and staging/turn areas",
    ],
    electrical_service_upgrade: [
      "Photos of the electrical panel",
      "Photos of the meter and service area",
      "Photos or sketch of the proposed hookup path",
      "Any utility or electrical plan document",
    ],
    utility_tie_in_verification: [
      "Photos showing water, sewer, or utility stub locations",
      "A simple site sketch marking existing hookups",
      "Any utility layout document or prior service notes",
    ],
    grading_and_drainage: [
      "Wide photos of grade and drainage conditions",
      "Photos of low spots, runoff paths, or erosion areas",
      "A short walkaround video after rain if available",
    ],
    permit_and_inspection_coordination: [
      "Permit application or approval documents",
      "Site plan or utility approval paperwork",
      "Any jurisdiction or inspector notes already received",
    ],
    site_access_logistics: [
      "Photos of gate width and driveway access",
      "Photos of truck turnaround or staging areas",
      "A short video showing the path from entry to work area",
    ],
  };

  if (item.item_key === "unified_project_package" || item.item_key.startsWith("trade_package_")) {
    return [
      "Photos of the work area and current conditions",
      "A scope sketch, markup, or measurement notes",
      "Any documents that define quantities or finish expectations",
    ];
  }

  return byItemKey[item.item_key] || [
    "Photos or documents that directly show this scope item",
  ];
}

function getScopeItemUploadCoverage(
  item: ProjectAiScopeItemDraft,
  input: ProjectAiAnalysisInput
): ProjectAiScopeItemUploadCoverage {
  const { imageCount, videoCount, documentCount } = getFileSignalCounts(input.files);
  const relevantFiles = getScopeItemRelevantFiles(item, input);
  const relevantPhotoFiles = relevantFiles.filter((file) => file.fileKind === "image");
  const relevantVideoFiles = relevantFiles.filter((file) => file.fileKind === "video");
  const relevantDocumentFiles = relevantFiles.filter(
    (file) => file.fileKind === "document"
  );

  return {
    hasRelevantVisualEvidence:
      relevantPhotoFiles.length > 0 || relevantVideoFiles.length > 0,
    hasRelevantDocumentEvidence: relevantDocumentFiles.length > 0,
    hasAnyVisualEvidence: imageCount > 0 || videoCount > 0,
    hasAnyDocumentEvidence: documentCount > 0,
    relevantPhotoFiles,
    relevantVideoFiles,
    relevantDocumentFiles,
    recommendedUploads: getScopeItemRecommendedUploads(item),
  };
}

function buildItemEvidenceSignals(params: {
  item: ProjectAiScopeItemDraft;
  input: ProjectAiAnalysisInput;
  analysis: ProjectAiAnalysisResult;
}): ProjectAiScopeItemEvidenceSignal[] {
  const { item, input, analysis } = params;
  const clarificationAnswers = input.clarificationAnswers || [];
  const textBlob = normalizeText(
    [input.title, input.description, input.completionCriteria].filter(Boolean).join(" ")
  );
  const { imageCount, videoCount, documentCount } = getFileSignalCounts(input.files);
  const coverage = getScopeItemUploadCoverage(item, input);
  const relevantFiles = [
    ...coverage.relevantPhotoFiles,
    ...coverage.relevantVideoFiles,
    ...coverage.relevantDocumentFiles,
  ];
  const signals: ProjectAiScopeItemEvidenceSignal[] = [];

  const answerStats = getScopeItemAnswerStats(item, input);
  if (answerStats.answered > 0) {
    signals.push(
      buildEvidenceSignal(
        "item_answers",
        "Customer answered item questions",
        answerStats.answered === answerStats.total && answerStats.total > 0
          ? "All currently generated item-specific clarification questions have answers."
          : `${answerStats.answered} item-specific clarification answer(s) are helping support this scope item.`,
        {
          strength: answerStats.answered === answerStats.total ? "direct" : "supporting",
          source: "item_answer",
        }
      )
    );
  }

  if (item.item_key === "unified_project_package" || item.item_key.startsWith("trade_package_")) {
    const totalBenchmarks = analysis.trade_breakdown.reduce(
      (sum, t) => sum + t.benchmark_count, 0
    );

    if (totalBenchmarks > 0) {
      signals.push(
        buildEvidenceSignal(
          "trade_history",
          "Historical bid signal",
          `${totalBenchmarks} internal benchmark bid(s) exist across related trades.`,
          {
            strength: totalBenchmarks >= 3 ? "direct" : "supporting",
            source: "trade_history",
          }
        )
      );
    }
  }

  const textKeywordsByItemKey: Record<string, string[]> = {
    modular_site_prep: ["modular", "site", "pad", "setup", "home"],
    modular_foundation_support: ["foundation", "pier", "anchor", "modular", "home"],
    modular_delivery_set_logistics: ["delivery", "set", "access", "modular", "home"],
    electrical_service_upgrade: ["electrical", "amp", "panel", "power", "service", "hookup"],
    utility_tie_in_verification: ["utility", "water", "sewer", "stub", "connection", "hookup"],
    grading_and_drainage: ["grading", "grade", "drainage", "drain", "gravel", "level"],
    permit_and_inspection_coordination: ["permit", "inspection", "code", "approval"],
    site_access_logistics: ["access", "gate", "staging", "delivery", "turnaround"],
  };

  const itemKeywords = textKeywordsByItemKey[item.item_key] || [];
  if (
    itemKeywords.length > 0 &&
    itemKeywords.some((keyword) => textBlob.includes(keyword))
  ) {
    signals.push(
      buildEvidenceSignal(
        "project_text",
        "Project text match",
        "The project title, description, or completion criteria contains language related to this scope item.",
        {
          strength: "supporting",
          source: "project_text",
        }
      )
    );
  }

  const relevantPhotoFiles = coverage.relevantPhotoFiles;
  const relevantVideoFiles = coverage.relevantVideoFiles;
  const relevantDocumentFiles = coverage.relevantDocumentFiles;
  const extractedExcerpts = Array.from(
    new Set(
      relevantDocumentFiles
        .map((file) => file.extractionExcerpt)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  ).slice(0, 2);
  const derivedSignals = Array.from(
    new Set(
      relevantFiles.flatMap((file) => [
        ...file.matchedTags,
        ...file.extractionHints,
        ...file.extractionEntities,
        ...(file.extractionNextStep ? [file.extractionNextStep] : []),
        ...(file.extractionSummary ? [file.extractionSummary] : []),
      ])
    )
  );

  if (relevantPhotoFiles.length > 0) {
    signals.push(
      buildEvidenceSignal(
        "matched_uploaded_photos",
        "Matched uploaded photos",
        `${relevantPhotoFiles.length} uploaded photo file(s) appear relevant to this item based on derived upload tags and filename clues.`,
        {
          strength: relevantPhotoFiles.length >= 2 ? "direct" : "supporting",
          source: "uploaded_photo",
          matched_files: relevantPhotoFiles.map((file) => file.fileName),
          matched_signals: derivedSignals,
        }
      )
    );
  }

  if (relevantVideoFiles.length > 0) {
    signals.push(
      buildEvidenceSignal(
        "matched_uploaded_videos",
        "Matched uploaded video",
        `${relevantVideoFiles.length} uploaded video file(s) appear relevant to this item based on derived upload tags and filename clues.`,
        {
          strength: "supporting",
          source: "uploaded_video",
          matched_files: relevantVideoFiles.map((file) => file.fileName),
          matched_signals: derivedSignals,
        }
      )
    );
  }

  if (relevantDocumentFiles.length > 0) {
    signals.push(
      buildEvidenceSignal(
        "matched_uploaded_documents",
        "Matched uploaded documents",
        `${relevantDocumentFiles.length} uploaded document file(s) appear relevant to this item based on derived upload tags and filename clues.`,
        {
          strength: relevantDocumentFiles.length >= 1 ? "direct" : "supporting",
          source: "uploaded_document",
          matched_files: relevantDocumentFiles.map((file) => file.fileName),
          matched_signals: derivedSignals,
          matched_excerpts: extractedExcerpts,
        }
      )
    );
  }

  if (
    !coverage.hasRelevantVisualEvidence ||
    (!coverage.hasRelevantDocumentEvidence &&
      ["electrical", "foundation", "permit", "utility", "water", "sewer"].includes(
        item.item_category
      ))
  ) {
    signals.push(
      buildEvidenceSignal(
        "recommended_uploads",
        "Recommended uploads",
        "The estimator still has a coverage gap for this item. Adding more item-specific uploads would improve confidence and help tighten the planning range.",
        {
          strength: "limited",
          source: "ai_inference",
          verification_gap:
            !coverage.hasRelevantVisualEvidence && coverage.hasAnyVisualEvidence
              ? "Files are uploaded on the project, but none are clearly mapped to this item yet."
              : !coverage.hasRelevantVisualEvidence
                ? "This item still lacks clearly relevant visual evidence."
                : "This item still lacks clearly relevant supporting documents.",
          recommended_uploads: coverage.recommendedUploads,
        }
      )
    );
  }

  const siteVisibleCategories: ProjectAiScopeItemCategory[] = [
    "site_prep",
    "grading",
    "drainage",
    "delivery",
    "utility",
    "water",
    "sewer",
    "foundation",
  ];

  if (
    imageCount > 0 &&
    relevantPhotoFiles.length === 0 &&
    siteVisibleCategories.includes(item.item_category)
  ) {
    signals.push(
      buildEvidenceSignal(
        "uploaded_photos",
        "Uploaded site photos",
        `${imageCount} photo(s) are available as site context for this item, but the AI has not visually verified the exact quantity or condition from the media alone.`,
        {
          strength: "supporting",
          source: "uploaded_photo",
          verification_gap:
            "The uploaded photos may be useful, but their filenames do not clearly identify this item yet.",
        }
      )
    );
  }

  if (
    videoCount > 0 &&
    relevantVideoFiles.length === 0 &&
    siteVisibleCategories.includes(item.item_category)
  ) {
    signals.push(
      buildEvidenceSignal(
        "uploaded_videos",
        "Uploaded site video",
        `${videoCount} video file(s) are available as site context for access, layout, and setup-related interpretation, but they are not treated as direct visual confirmation yet.`,
        {
          strength: "supporting",
          source: "uploaded_video",
          verification_gap:
            "The uploaded videos may be useful, but their filenames do not clearly identify this item yet.",
        }
      )
    );
  }

  if (
    documentCount > 0 &&
    relevantDocumentFiles.length === 0 &&
    ["electrical", "foundation", "permit", "utility", "water", "sewer"].includes(
      item.item_category
    )
  ) {
    signals.push(
      buildEvidenceSignal(
        "uploaded_documents",
        "Uploaded project documents",
        `${documentCount} document(s) are available and may support this item, but the current estimator is not yet parsing plan-sheet details line by line.`,
        {
          strength: "supporting",
          source: "uploaded_document",
          verification_gap:
            "The uploaded documents may matter here, but their filenames do not clearly map to this item yet.",
        }
      )
    );
  }

  if (signals.length === 0) {
    signals.push(
      buildEvidenceSignal(
        "ai_inference_only",
        "AI inference",
        "This item is currently being surfaced mostly from pattern matching and project context, with limited direct supporting evidence.",
        {
          strength: "limited",
          source: "ai_inference",
        }
      )
    );
  }

  return signals;
}

function applyConfidenceUpgrades(params: {
  item: ProjectAiScopeItemDraft;
  input: ProjectAiAnalysisInput;
  range: PricingRange | null;
}) {
  const { item, input, range } = params;
  const answerStats = getScopeItemAnswerStats(item, input);
  let nextConfidence = item.confidence_level;

  if (range && answerStats.total > 0 && answerStats.answered === answerStats.total) {
    nextConfidence = getNextConfidenceLevel(nextConfidence, "up");
  } else if (range && answerStats.answered > 0) {
    if (nextConfidence === "low") {
      nextConfidence = "medium";
    }
  } else if (!range && item.source_method === "ai_assembly") {
    nextConfidence = "low";
  }

  const baseReason =
    item.confidence_reason ||
    "This item is still being estimated from an early scope signal.";

  const answeredSummary =
    answerStats.total === 0
      ? "This item does not currently have item-specific follow-up questions."
      : answerStats.answered === 0
        ? "No item-specific clarification answers have been provided yet."
        : answerStats.answered === answerStats.total
          ? "All currently generated item-specific clarifications have been answered."
          : `${answerStats.answered} of ${answerStats.total} item-specific clarification questions have been answered.`;

  return {
    ...item,
    confidence_level: nextConfidence,
    confidence_reason: `${baseReason} ${answeredSummary}`.trim(),
  };
}

function resolveUnifiedPackageFallbackRange(
  item: ProjectAiScopeItemDraft,
  input: ProjectAiAnalysisInput
) {
  const budgetMidpoint = getBudgetMidpoint(input);
  if (!budgetMidpoint) {
    return createRange(2500, 8500);
  }

  const range = createRange(budgetMidpoint * 0.75, budgetMidpoint * 1.15);

  if (item.confidence_level === "low") {
    return scaleRange(range, 0.95);
  }

  return range;
}

function resolveItemRange(params: {
  item: ProjectAiScopeItemDraft;
  input: ProjectAiAnalysisInput;
  analysis: ProjectAiAnalysisResult;
}) {
  const { item, input, analysis } = params;
  const clarificationAnswers = input.clarificationAnswers || [];
  const currentRange =
    item.estimated_low !== null && item.estimated_high !== null
      ? createRange(item.estimated_low, item.estimated_high)
      : null;

  if (item.item_key === "unified_project_package" || item.item_key.startsWith("trade_package_")) {
    const scopeDetail = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "scope_detail")
    );
    const range = currentRange || resolveUnifiedPackageFallbackRange(item, input);

    if (!scopeDetail) {
      return range;
    }

    const tightened = tightenRange(range, scopeDetail.length > 40 ? 0.78 : 0.88);
    return textSuggestsComplexity(scopeDetail)
      ? scaleRange(tightened, 1.08)
      : tightened;
  }

  if (item.item_key === "modular_site_prep") {
    const padCondition = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "existing_pad_condition")
    );
    const notes = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "pad_size_or_notes")
    );
    let range =
      getTradeAnchoredRange(analysis, ["concrete", "general work"]) ||
      getBudgetAnchoredRange(input, 0.12, createRange(4500, 16000));

    if (padCondition === "bare_dirt") range = scaleRange(range, 1.15);
    if (padCondition === "existing_gravel") range = scaleRange(range, 0.92);
    if (padCondition === "concrete_pad") range = scaleRange(range, 0.78);
    if (notes.length > 0) range = tightenRange(range, notes.length > 35 ? 0.8 : 0.9);

    return range;
  }

  if (item.item_key === "modular_foundation_support") {
    const foundationType = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "foundation_type_known")
    );
    let range = getBudgetAnchoredRange(input, 0.1, createRange(4000, 14000));

    if (foundationType === "needs_piers_or_anchors") range = scaleRange(range, 1.18);
    if (foundationType === "yes_specified") range = tightenRange(range, 0.82);

    return range;
  }

  if (item.item_key === "modular_delivery_set_logistics") {
    const notes = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "delivery_access_notes")
    );
    let range = getBudgetAnchoredRange(input, 0.08, createRange(3000, 12000));

    if (textSuggestsComplexity(notes)) range = scaleRange(range, 1.22);
    if (textSuggestsSimpleAccess(notes)) range = scaleRange(range, 0.82);
    if (notes.length > 0) range = tightenRange(range, 0.88);

    return range;
  }

  if (item.item_key === "electrical_service_upgrade") {
    const serviceSize = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "target_service_size")
    );
    const distanceNotes = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "electrical_distance_notes")
    );
    let range =
      serviceSize === "30_amp"
        ? createRange(1800, 4500)
        : serviceSize === "50_amp"
          ? createRange(2500, 6500)
          : serviceSize === "100_amp"
            ? createRange(4500, 9500)
            : serviceSize === "200_amp"
              ? createRange(8000, 18000)
              : getTradeAnchoredRange(analysis, ["electrical"]) ||
                getBudgetAnchoredRange(input, 0.1, createRange(4000, 12000));

    const feet = extractFeetEstimate(distanceNotes);
    if (feet !== null) {
      if (feet > 150) range = scaleRange(range, 1.35);
      else if (feet > 75) range = scaleRange(range, 1.18);
      else if (feet > 25) range = scaleRange(range, 1.06);
      else range = scaleRange(range, 0.95);
      range = tightenRange(range, 0.86);
    } else if (distanceNotes.length > 0) {
      if (textSuggestsComplexity(distanceNotes)) range = scaleRange(range, 1.12);
      range = tightenRange(range, 0.92);
    }

    return range;
  }

  if (item.item_key === "utility_tie_in_verification") {
    const utilitiesReady = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "existing_utilities_ready")
    );
    let range = getBudgetAnchoredRange(input, 0.09, createRange(2500, 9000));

    if (utilitiesReady === "yes_aligned") range = scaleRange(range, 0.78);
    if (utilitiesReady === "partially_aligned") range = scaleRange(range, 1.05);
    if (utilitiesReady === "no_relocation_likely") range = scaleRange(range, 1.28);
    if (utilitiesReady) range = tightenRange(range, 0.88);

    return range;
  }

  if (item.item_key === "grading_and_drainage") {
    const gradingCondition = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "grading_condition")
    );

    if (gradingCondition === "appears_level_and_dry") return createRange(1500, 4000);
    if (gradingCondition === "minor_irregularities") return createRange(3000, 8500);
    if (gradingCondition === "obvious_drainage_issue") return createRange(7000, 18000);

    return getBudgetAnchoredRange(input, 0.1, createRange(2500, 9000));
  }

  if (item.item_key === "permit_and_inspection_coordination") {
    const permitExpectation = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "permit_expectation")
    );

    if (permitExpectation === "customer") return createRange(500, 1500);
    if (permitExpectation === "shared") return createRange(1200, 3500);
    if (permitExpectation === "contractor") return createRange(2000, 6000);

    return createRange(900, 3000);
  }

  if (item.item_key === "site_access_logistics") {
    const notes = getAnswerText(
      getScopeItemAnswer(clarificationAnswers, item.item_key, "site_access_constraints")
    );
    let range = createRange(800, 4000);

    if (textSuggestsComplexity(notes)) range = scaleRange(range, 1.3);
    if (textSuggestsSimpleAccess(notes)) range = scaleRange(range, 0.8);
    if (notes.length > 0) range = tightenRange(range, 0.88);

    return range;
  }

  return currentRange;
}

function applyAnswerDrivenPricing(params: {
  item: ProjectAiScopeItemDraft;
  input: ProjectAiAnalysisInput;
  analysis: ProjectAiAnalysisResult;
  wageEntry: TradeWageEntry | null;
  llmLaborHourEstimate?: { total_hours_low: number; total_hours_high: number; reasoning: string } | null;
}) {
  const range = resolveItemRange(params);
  const { wageEntry, llmLaborHourEstimate } = params;

  // When the LLM provided labor-hour estimates AND we have a wage entry,
  // build the range from hours × rate instead of from budget anchoring.
  // This only applies to the unified project package.
  let effectiveRange = range;
  if (
    llmLaborHourEstimate &&
    wageEntry &&
    params.item.item_key === "unified_project_package" &&
    range
  ) {
    const ratios = getItemCostSplitRatios(params.item);
    const laborLow = llmLaborHourEstimate.total_hours_low * wageEntry.hourly_rate;
    const laborHigh = llmLaborHourEstimate.total_hours_high * wageEntry.hourly_rate;
    // Reconstruct total from LLM-driven labor + ratio-derived material & equipment
    const totalLow = ratios.labor > 0 ? laborLow / ratios.labor : range.low;
    const totalHigh = ratios.labor > 0 ? laborHigh / ratios.labor : range.high;
    effectiveRange = normalizeRange({
      low: Math.min(totalLow, totalHigh),
      high: Math.max(totalLow, totalHigh),
    });
  }

  const withRange = {
    ...params.item,
    estimated_low: effectiveRange?.low ?? null,
    estimated_high: effectiveRange?.high ?? null,
  };
  const withSplits = applyCostSplits(withRange, effectiveRange, wageEntry);
  const withConfidence = applyConfidenceUpgrades({
    item: withSplits,
    input: params.input,
    range: effectiveRange,
  });
  const { assumptions, exclusions } = buildItemAssumptionsAndExclusions({
    item: withConfidence,
    input: params.input,
    range: effectiveRange,
  });

  return {
    ...withConfidence,
    quantity_drivers_json: buildItemQuantityDrivers({
      item: withConfidence,
      input: params.input,
      analysis: params.analysis,
      range: effectiveRange,
      wageEntry,
      llmLaborHourEstimate:
        params.item.item_key === "unified_project_package" ? llmLaborHourEstimate : null,
    }),
    evidence_signals_json: buildItemEvidenceSignals({
      item: withConfidence,
      input: params.input,
      analysis: params.analysis,
    }),
    assumptions_json: assumptions,
    exclusions_json: exclusions,
  };
}

export function buildProjectAiScopeItems(params: {
  input: ProjectAiAnalysisInput;
  analysis: ProjectAiAnalysisResult;
  llmLaborHourEstimate?: { total_hours_low: number; total_hours_high: number; reasoning: string } | null;
}): ProjectAiScopeItemDraft[] {
  const { input, analysis } = params;
  const items: ProjectAiScopeItemDraft[] = [];
  const textBlob = normalizeText(
    [input.title, input.description, input.completionCriteria].filter(Boolean).join(" ")
  );
  const clarificationAnswers = input.clarificationAnswers || [];

  // Build ONE unified work package for the entire project instead of
  // one per trade. Materials and quantities are constant regardless of
  // who performs the work; only the labor rate varies. We default to
  // the highest licensed professional rate across selected trades.
  const tradeLabels = analysis.trade_breakdown
    .map((t) => TRADE_LABELS[t.trade as TradeCategory] || t.label)
    .filter(Boolean);
  const tradeNames = tradeLabels.length > 0 ? tradeLabels : ["General"];
  const tradeKeys = analysis.trade_breakdown.map((t) => t.trade);
  const wageEntry = input.expertiseLevel
    ? getWageForExpertiseLevel(input.expertiseLevel)
    : getMaxTradeWage(tradeKeys);

  const hasAnyBenchmark = analysis.trade_breakdown.some(
    (t) => t.source === "historical_bids"
  );
  const bestSource: ProjectAiTradeBreakdownItem["source"] = hasAnyBenchmark
    ? "historical_bids"
    : analysis.trade_breakdown.some((t) => t.source === "budget_signal")
      ? "budget_signal"
      : "insufficient_signal";

  pushUniqueItem(items, {
    item_key: "unified_project_package",
    item_label: "Project work package",
    item_category: "other",
    required_status: "required",
    confidence_level:
      hasAnyBenchmark
        ? "high"
        : analysis.confidence_level === "high"
          ? "medium"
          : "low",
    description:
      `Unified estimate for the full project scope. Labor priced at ${wageEntry.role_label} rate ($${wageEntry.hourly_rate}/hr).`,
    why_it_may_apply:
      tradeNames.length > 1
        ? `This project is open to bids from: ${tradeNames.join(", ")}.`
        : `This project targets ${tradeNames[0]} contractors.`,
    confidence_reason:
      hasAnyBenchmark
        ? "This package has internal bid history to support a directional range."
        : bestSource === "budget_signal"
          ? "This package currently leans on the customer budget because internal benchmark data is limited."
          : "There is not enough pricing signal for a reliable range yet.",
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
      `Labor costed at ${wageEntry.role_label} prevailing wage ($${wageEntry.hourly_rate}/hr). Actual bids may be lower.`,
    ],
    exclusions_json: [],
    source_method: mapTradeBreakdownSource(bestSource),
    needs_clarification:
      analysis.status !== "ready" || !hasAnyBenchmark,
    display_order: items.length,
  });

  // Per DESIGN_PRINCIPLES.md: only add heuristic items that match what the
  // user ACTUALLY described. Don't assume crane, piers, delivery, etc. just
  // because the title mentions "modular." Only add what the text supports.
  const isModularHomeScope =
    /(modular|manufactured|mobile home|trailer home)/.test(textBlob) &&
    /(site|pad|hookup|utility|set|setup|home site|rv)/.test(textBlob);

  if (isModularHomeScope) {
    const mentionsSitePrep = /(site prep|pad|grade|grading|compact|level|clear|dirt|gravel|fill)/.test(textBlob);
    const mentionsFoundation = /(pier|anchor|foundation|block|footing|tie.?down)/.test(textBlob);
    const mentionsDelivery = /(deliver|crane|set day|set.?up|transport|haul|move.?in|placement)/.test(textBlob);

    if (mentionsSitePrep) {
      pushUniqueItem(items, {
        item_key: "modular_site_prep",
        item_label: "Site preparation and pad readiness",
        item_category: "site_prep",
        required_status: "possible",
        confidence_level: "medium",
        description:
          "Prepare the home site — grading, compaction, and base preparation as described in the project scope.",
        why_it_may_apply:
          "The project description explicitly references site or pad preparation work.",
        confidence_reason:
          "Site prep is referenced in the description, but exact dimensions and soil conditions may still be unclear.",
        estimated_low: null,
        estimated_high: null,
        labor_low: null,
        labor_high: null,
        material_low: null,
        material_high: null,
        equipment_low: null,
        equipment_high: null,
        quantity_drivers_json: [],
        evidence_signals_json: [],
        assumptions_json: [],
        exclusions_json: [],
        source_method: "ai_assembly",
        needs_clarification: true,
        display_order: items.length,
      });
    }

    if (mentionsFoundation) {
      pushUniqueItem(items, {
        item_key: "modular_foundation_support",
        item_label: "Foundation, piers, or anchoring system",
        item_category: "foundation",
        required_status: "possible",
        confidence_level: "low",
        description:
          "Determine whether the home requires piers, blocking, tie-downs, or a more formal foundation/anchoring system.",
        why_it_may_apply:
          "The project description references foundation or anchoring work.",
        confidence_reason:
          "The current project details do not yet confirm the manufacturer requirements or jurisdictional setup rules.",
        estimated_low: null,
        estimated_high: null,
        labor_low: null,
        labor_high: null,
        material_low: null,
        material_high: null,
        equipment_low: null,
        equipment_high: null,
        quantity_drivers_json: [],
        evidence_signals_json: [],
        assumptions_json: [],
        exclusions_json: [],
        source_method: "ai_assembly",
        needs_clarification: true,
        display_order: items.length,
      });
    }

    if (mentionsDelivery) {
      pushUniqueItem(items, {
        item_key: "modular_delivery_set_logistics",
        item_label: "Delivery and set-day logistics",
        item_category: "delivery",
        required_status: "possible",
        confidence_level: "low",
        description:
          "Review transport access, crane or set-day needs, and the path required to place the modular home on site.",
        why_it_may_apply:
          "The project description mentions delivery, transport, or set-day logistics.",
        confidence_reason:
          "The current description references delivery but specific constraints are not yet confirmed.",
        estimated_low: null,
        estimated_high: null,
        labor_low: null,
        labor_high: null,
        material_low: null,
        material_high: null,
        equipment_low: null,
        equipment_high: null,
        quantity_drivers_json: [],
        evidence_signals_json: [],
        assumptions_json: [],
        exclusions_json: [],
        source_method: "ai_assembly",
        needs_clarification: true,
        display_order: items.length,
      });
    }
  }

  if (
    /(hookup|service|amp|panel|power|electrical|rv hookup)/.test(textBlob) ||
    getClarificationAnswer(clarificationAnswers, "electrical_scope_details")
  ) {
    pushUniqueItem(items, {
      item_key: "electrical_service_upgrade",
      item_label: "Electrical service and hookup upgrades",
      item_category: "electrical",
      required_status: "possible",
      confidence_level: "medium",
      description:
        "Review service size, feeder runs, hookup changes, and any panel or meter work needed for the final installation.",
      why_it_may_apply:
        "The project references electrical hookups or service changes, which often trigger upgrade or coordination work.",
      confidence_reason:
        "The exact power requirements and distance to the final connection point are not yet confirmed.",
      estimated_low: null,
      estimated_high: null,
      labor_low: null,
      labor_high: null,
      material_low: null,
      material_high: null,
      equipment_low: null,
      equipment_high: null,
      quantity_drivers_json: [],
      evidence_signals_json: [],
      assumptions_json: [],
      exclusions_json: [],
      source_method: "ai_assembly",
      needs_clarification: true,
      display_order: items.length,
    });
  }

  if (/(sewer|water|utility|hookup|stub|connection)/.test(textBlob)) {
    pushUniqueItem(items, {
      item_key: "utility_tie_in_verification",
      item_label: "Utility tie-in verification",
      item_category: "utility",
      required_status: "possible",
      confidence_level: "medium",
      description:
        "Confirm whether existing sewer, water, and utility stubs align with the final home placement or need adjustment.",
      why_it_may_apply:
        "Projects that reuse existing hookups often still need location, capacity, or code-compliance verification.",
      confidence_reason:
        "The current scope mentions existing utility hookups, but not whether they match the new home layout.",
      estimated_low: null,
      estimated_high: null,
      labor_low: null,
      labor_high: null,
      material_low: null,
      material_high: null,
      equipment_low: null,
      equipment_high: null,
      quantity_drivers_json: [],
      evidence_signals_json: [],
      assumptions_json: [],
      exclusions_json: [],
      source_method: "ai_assembly",
      needs_clarification: true,
      display_order: items.length,
    });
  }

  if (/(grade|grading|level|drain|drainage|gravel|base|erosion)/.test(textBlob)) {
    pushUniqueItem(items, {
      item_key: "grading_and_drainage",
      item_label: "Grading, drainage, or base correction",
      item_category: "grading",
      required_status: "possible",
      confidence_level: "low",
      description:
        "Check whether the site needs grading, gravel base, compaction, drainage correction, or erosion-control improvements.",
      why_it_may_apply:
        "Site prep scopes often need drainage or base work even when the area appears generally level.",
      confidence_reason:
        "The project text suggests possible site work concerns, but current conditions are not visually confirmed in enough detail.",
      estimated_low: null,
      estimated_high: null,
      labor_low: null,
      labor_high: null,
      material_low: null,
      material_high: null,
      equipment_low: null,
      equipment_high: null,
      quantity_drivers_json: [],
      evidence_signals_json: [],
      assumptions_json: [],
      exclusions_json: [],
      source_method: "ai_assembly",
      needs_clarification: true,
      display_order: items.length,
    });
  }

  if (
    !getClarificationAnswer(clarificationAnswers, "permit_expectations") ||
    /(permit|inspection|code|utility company)/.test(textBlob)
  ) {
    pushUniqueItem(items, {
      item_key: "permit_and_inspection_coordination",
      item_label: "Permit and inspection coordination",
      item_category: "permit",
      required_status: "possible",
      confidence_level: "low",
      description:
        "Review whether permits, inspections, or utility approvals will be needed before the site can be considered complete.",
      why_it_may_apply:
        "Site conversion, service changes, and modular installation often involve code or inspection requirements.",
      confidence_reason:
        "Permit expectations are not fully confirmed yet, so this remains a likely planning item rather than a priced scope item.",
      estimated_low: null,
      estimated_high: null,
      labor_low: null,
      labor_high: null,
      material_low: null,
      material_high: null,
      equipment_low: null,
      equipment_high: null,
      quantity_drivers_json: [],
      evidence_signals_json: [],
      assumptions_json: [],
      exclusions_json: [],
      source_method: "ai_assembly",
      needs_clarification: true,
      display_order: items.length,
    });
  }

  if (
    !getClarificationAnswer(clarificationAnswers, "site_access_constraints") ||
    analysis.missing_items.some((item) =>
      item.toLowerCase().includes("site access")
    )
  ) {
    pushUniqueItem(items, {
      item_key: "site_access_logistics",
      item_label: "Site access and work logistics",
      item_category: "delivery",
      required_status: "possible",
      confidence_level: "low",
      description:
        "Account for access, work-hour limits, gate codes, staging space, or occupancy restrictions that can affect delivery and labor cost.",
      why_it_may_apply:
        "Access constraints can materially change labor, equipment, and setup planning even when the physical scope stays the same.",
      confidence_reason:
        "Access details remain incomplete or only partially confirmed in the current scope.",
      estimated_low: null,
      estimated_high: null,
      labor_low: null,
      labor_high: null,
      material_low: null,
      material_high: null,
      equipment_low: null,
      equipment_high: null,
      quantity_drivers_json: [],
      evidence_signals_json: [],
      assumptions_json: [],
      exclusions_json: [],
      source_method: "manual_review",
      needs_clarification: true,
      display_order: items.length,
    });
  }

  const llmLaborHourEstimate = params.llmLaborHourEstimate ?? null;

  return items.map((item) =>
    applyAnswerDrivenPricing({
      item,
      input,
      analysis,
      wageEntry,
      llmLaborHourEstimate,
    })
  );
}

function getScopeItemClarificationBlueprints(
  item: ProjectAiScopeItemDraft,
  input?: ProjectAiAnalysisInput
) {
  const mediaBlueprints = input
    ? buildScopeItemUploadRequestBlueprints(item, input)
    : [];

  switch (item.item_key) {
    case "modular_site_prep":
      return [
        {
          question_key: buildScopeItemQuestionKey(item.item_key, "existing_pad_condition"),
          question_text: "What best describes the current pad or base condition?",
          question_type: "single_select" as const,
          help_text:
            "This helps the AI judge whether grading, gravel, compaction, or additional base prep may still be needed.",
          placeholder: null,
          options_json: [
            buildOption("bare_dirt", "Mostly bare dirt"),
            buildOption("existing_gravel", "Existing gravel or rock base"),
            buildOption("concrete_pad", "Existing slab or concrete pad"),
            buildOption("unknown", "I am not sure yet"),
          ],
        },
        {
          question_key: buildScopeItemQuestionKey(item.item_key, "pad_size_or_notes"),
          question_text: "What do you know about the pad size, dimensions, or desired home footprint?",
          question_type: "text" as const,
          help_text:
            "Even rough dimensions or notes help the AI reason about prep effort and material quantities.",
          placeholder: "Example: approximately 60 ft x 30 ft, mostly level, replacing two RV pads",
          options_json: [],
        },
        ...mediaBlueprints,
      ];
    case "modular_foundation_support":
      return [
        {
          question_key: buildScopeItemQuestionKey(item.item_key, "foundation_type_known"),
          question_text: "Do you already know the required foundation or anchoring type?",
          question_type: "single_select" as const,
          help_text:
            "Manufacturer requirements, tie-downs, piers, and local rules can materially change this line item.",
          placeholder: null,
          options_json: [
            buildOption("yes_specified", "Yes, it has already been specified"),
            buildOption("needs_piers_or_anchors", "I think it needs piers or anchors"),
            buildOption("unsure", "Not sure yet"),
          ],
        },
        ...mediaBlueprints,
      ];
    case "modular_delivery_set_logistics":
      return [
        {
          question_key: buildScopeItemQuestionKey(item.item_key, "delivery_access_notes"),
          question_text: "What do you know about delivery path access, turning room, or crane/set-day constraints?",
          question_type: "text" as const,
          help_text:
            "Tight turns, overhead lines, soft ground, or limited staging space can change labor and equipment planning.",
          placeholder: "Example: narrow gate, overhead power line near entrance, flat open staging area, unknown",
          options_json: [],
        },
        ...mediaBlueprints,
      ];
    case "electrical_service_upgrade":
      return [
        {
          question_key: buildScopeItemQuestionKey(item.item_key, "target_service_size"),
          question_text: "What service size or hookup target is the project aiming for?",
          question_type: "single_select" as const,
          help_text:
            "Amp size is one of the biggest drivers for electrical scope and price range direction.",
          placeholder: null,
          options_json: [
            buildOption("30_amp", "30 amp"),
            buildOption("50_amp", "50 amp"),
            buildOption("100_amp", "100 amp"),
            buildOption("200_amp", "200 amp"),
            buildOption("unknown", "Not sure yet"),
          ],
        },
        {
          question_key: buildScopeItemQuestionKey(item.item_key, "electrical_distance_notes"),
          question_text: "How far is the final hookup location from the existing power source or panel?",
          question_type: "text" as const,
          help_text:
            "Distance and trenching complexity strongly affect labor, conduit, wire, and equipment needs.",
          placeholder: "Example: about 40 feet from existing panel, same side of lot, unknown",
          options_json: [],
        },
        ...mediaBlueprints,
      ];
    case "utility_tie_in_verification":
      return [
        {
          question_key: buildScopeItemQuestionKey(item.item_key, "existing_utilities_ready"),
          question_text: "Are the existing sewer, water, and utility hookups already at the final home location?",
          question_type: "single_select" as const,
          help_text:
            "If the utility locations do not line up with the final home placement, relocation work may be needed.",
          placeholder: null,
          options_json: [
            buildOption("yes_aligned", "Yes, they are already aligned"),
            buildOption("no_relocation_likely", "No, relocation may be needed"),
            buildOption("partially_aligned", "Some are aligned, some may not be"),
            buildOption("unknown", "Not sure yet"),
          ],
        },
        ...mediaBlueprints,
      ];
    case "grading_and_drainage":
      return [
        {
          question_key: buildScopeItemQuestionKey(item.item_key, "grading_condition"),
          question_text: "How would you describe the grading and drainage conditions today?",
          question_type: "single_select" as const,
          help_text:
            "Visible slope, low spots, pooling water, or soft ground can change this item from optional to necessary.",
          placeholder: null,
          options_json: [
            buildOption("appears_level_and_dry", "Appears level and dry"),
            buildOption("minor_irregularities", "Minor irregularities or soft spots"),
            buildOption("obvious_drainage_issue", "Obvious drainage or runoff issue"),
            buildOption("unknown", "Not sure yet"),
          ],
        },
        ...mediaBlueprints,
      ];
    case "permit_and_inspection_coordination":
      return [
        {
          question_key: buildScopeItemQuestionKey(item.item_key, "permit_expectation"),
          question_text: "Who is expected to handle permits, inspections, or utility approvals?",
          question_type: "single_select" as const,
          help_text:
            "Permit responsibility often affects project coordination, schedule risk, and soft-cost expectations.",
          placeholder: null,
          options_json: [
            buildOption("customer", "Customer will handle it"),
            buildOption("contractor", "Contractor should handle it"),
            buildOption("shared", "Probably shared"),
            buildOption("unknown", "Not sure yet"),
          ],
        },
        ...mediaBlueprints,
      ];
    case "site_access_logistics":
      return [
        {
          question_key: buildScopeItemQuestionKey(item.item_key, "site_access_constraints"),
          question_text: "What access or staging limitations should the estimator assume?",
          question_type: "text" as const,
          help_text:
            "Examples include gates, limited work hours, neighbors, soft ground, overhead obstructions, or no laydown space.",
          placeholder: "Example: narrow gate, soft shoulder, limited truck turnaround, no issues known yet",
          options_json: [],
        },
        ...mediaBlueprints,
      ];
    default:
      if (
        (item.item_key === "unified_project_package" || item.item_key.startsWith("trade_package_")) &&
        (item.needs_clarification ||
          item.estimated_low === null ||
          item.estimated_high === null)
      ) {
        return [
          {
            question_key: buildScopeItemQuestionKey(item.item_key, "scope_detail"),
            question_text: `What extra detail should estimators know about this project scope?`,
            question_type: "text" as const,
            help_text:
              "Scope notes such as quantities, access, finish level, or code constraints help tighten the directional range.",
            placeholder: "Add any quantities, measurements, access notes, or must-have details",
            options_json: [],
          },
          ...mediaBlueprints,
        ];
      }

      return mediaBlueprints;
  }
}

export function buildProjectAiItemClarifications(params: {
  items: ProjectAiScopeItemDraft[];
  input: ProjectAiAnalysisInput;
}): ProjectAiItemClarificationDraft[] {
  const { items, input } = params;

  return items.flatMap((item) => {
    const blueprints = getScopeItemClarificationBlueprints(item, input);

    return blueprints.map((blueprint, index) => {
      const answer = getClarificationAnswer(
        input.clarificationAnswers || [],
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
        status: hasMeaningfulAnswer(answer) ? "answered" : "pending",
        asked_by: "ai",
        display_order: index,
        answered_at: hasMeaningfulAnswer(answer) ? new Date().toISOString() : null,
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
    if (!counts) {
      return item;
    }

    return {
      ...item,
      needs_clarification: counts.pending > 0,
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
  const hasRange = item.estimated_low !== null && item.estimated_high !== null;

  if (item.source_method === "historical_bids" && hasRange) {
    return `This directional range leans on internal bid history for similar ${item.item_label.toLowerCase()} scopes, which is why confidence is currently ${item.confidence_level}.`;
  }

  if (item.source_method === "budget_signal" && hasRange) {
    return `This range is currently anchored by the customer's stated budget because direct internal pricing comps for this item are still limited.`;
  }

  if (item.source_method === "ai_assembly" && hasRange && !item.needs_clarification) {
    return "This directional range was assembled from the AI scope logic and tightened using the answered item details, so it should read as a preconstruction planning range rather than a final quote.";
  }

  if (item.source_method === "ai_assembly" && hasRange) {
    return "This directional range is being assembled from scope pattern matching, project context, and any answered item details. More specifics can still tighten it further.";
  }

  if (item.source_method === "ai_assembly" && !hasRange) {
    return "The AI believes this work item may belong in the scope, but it is holding back a hard directional range until a few item-specific details are confirmed.";
  }

  if (item.source_method === "manual_review") {
    return "This item is being surfaced as a planning and estimator-review item because access, code, or coordination conditions can swing pricing materially.";
  }

  if (!hasRange && item.needs_clarification) {
    return "There is not enough pricing signal yet. Answering the item-specific questions below should help the AI move this toward a more estimate-ready line item.";
  }

  return (
    item.confidence_reason ||
    "This line item is still an early directional signal and should be treated as preconstruction guidance rather than a contractor quote."
  );
}
