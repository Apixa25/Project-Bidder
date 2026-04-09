import type {
  ProjectAiAnalysisInput,
  ProjectAiAnalysisResult,
  ProjectAiClarificationAnswerInput,
  ProjectAiClarificationQuestionType,
  ProjectAiTradeBreakdownItem,
} from "@/lib/ai-estimates";
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

export function buildProjectAiScopeItems(params: {
  input: ProjectAiAnalysisInput;
  analysis: ProjectAiAnalysisResult;
}): ProjectAiScopeItemDraft[] {
  const { input, analysis } = params;
  const items: ProjectAiScopeItemDraft[] = [];
  const textBlob = normalizeText(
    [input.title, input.description, input.completionCriteria].filter(Boolean).join(" ")
  );
  const clarificationAnswers = input.clarificationAnswers || [];

  for (const tradeItem of analysis.trade_breakdown) {
    pushUniqueItem(items, {
      item_key: `trade_package_${tradeItem.trade}`,
      item_label: `${tradeItem.label} work package`,
      item_category: mapTradeToCategory(tradeItem.trade),
      required_status: "required",
      confidence_level:
        tradeItem.source === "historical_bids"
          ? "high"
          : analysis.confidence_level === "high"
            ? "medium"
            : "low",
      description: `High-level work package aligned to the selected ${tradeItem.label.toLowerCase()} scope.`,
      why_it_may_apply: `This project is tagged for ${TRADE_LABELS[tradeItem.trade as TradeCategory] || tradeItem.label}.`,
      confidence_reason:
        tradeItem.source === "historical_bids"
          ? "This package has internal bid history to support a directional range."
          : tradeItem.source === "budget_signal"
            ? "This package currently leans on the customer budget because internal benchmark data is limited."
            : "This package is likely relevant, but there is not enough pricing signal for a reliable range yet.",
      estimated_low: tradeItem.estimated_low,
      estimated_high: tradeItem.estimated_high,
      labor_low: null,
      labor_high: null,
      material_low: null,
      material_high: null,
      equipment_low: null,
      equipment_high: null,
      source_method: mapTradeBreakdownSource(tradeItem.source),
      needs_clarification:
        analysis.status !== "ready" || tradeItem.source !== "historical_bids",
      display_order: items.length,
    });
  }

  const isModularHomeScope =
    /(modular|manufactured|mobile home|trailer home)/.test(textBlob) &&
    /(site|pad|hookup|utility|set|setup|home site|rv)/.test(textBlob);

  if (isModularHomeScope) {
    pushUniqueItem(items, {
      item_key: "modular_site_prep",
      item_label: "Site preparation and pad readiness",
      item_category: "site_prep",
      required_status: "likely",
      confidence_level: "medium",
      description:
        "Prepare the home site so the modular unit can be delivered, set, and supported safely.",
      why_it_may_apply:
        "Modular home projects often require base preparation, compaction, and verification that the final site is ready for delivery and installation.",
      confidence_reason:
        "The project description references a modular home site conversion, but the exact pad and support requirements are still unclear.",
      estimated_low: null,
      estimated_high: null,
      labor_low: null,
      labor_high: null,
      material_low: null,
      material_high: null,
      equipment_low: null,
      equipment_high: null,
      source_method: "ai_assembly",
      needs_clarification: true,
      display_order: items.length,
    });

    pushUniqueItem(items, {
      item_key: "modular_foundation_support",
      item_label: "Foundation, piers, or anchoring system",
      item_category: "foundation",
      required_status: "possible",
      confidence_level: "medium",
      description:
        "Determine whether the home requires piers, blocking, tie-downs, or a more formal foundation/anchoring system.",
      why_it_may_apply:
        "Modular and manufactured homes typically need a verified support and anchoring approach before utilities and final setup can be completed.",
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
      source_method: "ai_assembly",
      needs_clarification: true,
      display_order: items.length,
    });

    pushUniqueItem(items, {
      item_key: "modular_delivery_set_logistics",
      item_label: "Delivery and set-day logistics",
      item_category: "delivery",
      required_status: "likely",
      confidence_level: "medium",
      description:
        "Review transport access, crane or set-day needs, and the path required to place the modular home on site.",
      why_it_may_apply:
        "Even when the site appears level, delivery access and placement logistics can create real setup requirements and costs.",
      confidence_reason:
        "The current description does not confirm delivery path constraints or whether special set equipment is needed.",
      estimated_low: null,
      estimated_high: null,
      labor_low: null,
      labor_high: null,
      material_low: null,
      material_high: null,
      equipment_low: null,
      equipment_high: null,
      source_method: "ai_assembly",
      needs_clarification: true,
      display_order: items.length,
    });
  }

  if (
    /(hookup|service|amp|panel|power|electrical|rv hookup)/.test(textBlob) ||
    getClarificationAnswer(clarificationAnswers, "electrical_scope_details")
  ) {
    pushUniqueItem(items, {
      item_key: "electrical_service_upgrade",
      item_label: "Electrical service and hookup upgrades",
      item_category: "electrical",
      required_status: "likely",
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
      required_status: "likely",
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
      source_method: "manual_review",
      needs_clarification: true,
      display_order: items.length,
    });
  }

  return items;
}

function getScopeItemClarificationBlueprints(item: ProjectAiScopeItemDraft) {
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
      ];
    default:
      if (
        item.item_key.startsWith("trade_package_") &&
        (item.needs_clarification ||
          item.estimated_low === null ||
          item.estimated_high === null)
      ) {
        return [
          {
            question_key: buildScopeItemQuestionKey(item.item_key, "scope_detail"),
            question_text: `What extra detail should estimators know about the ${item.item_label.toLowerCase()}?`,
            question_type: "text" as const,
            help_text:
              "Scope notes such as quantities, access, finish level, or code constraints help tighten the directional range.",
            placeholder: "Add any quantities, measurements, access notes, or must-have details",
            options_json: [],
          },
        ];
      }

      return [];
  }
}

export function buildProjectAiItemClarifications(params: {
  items: ProjectAiScopeItemDraft[];
  input: ProjectAiAnalysisInput;
}): ProjectAiItemClarificationDraft[] {
  const { items, input } = params;

  return items.flatMap((item) => {
    const blueprints = getScopeItemClarificationBlueprints(item);

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
