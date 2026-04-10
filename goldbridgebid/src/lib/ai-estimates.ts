import { TRADE_LABELS, type TradeCategory } from "@/types/database";

export type ProjectAiEstimateStatus =
  | "insufficient_data"
  | "needs_clarification"
  | "ready"
  | "stale";

export type ProjectAiConfidenceLevel = "low" | "medium" | "high";

export type ProjectAiClarificationQuestionType =
  | "single_select"
  | "multi_select"
  | "number"
  | "text"
  | "upload_request";

export type ProjectAiFileKind = "image" | "video" | "document";

export interface ProjectAiFileExtractionEntity {
  label: string;
  kind:
    | "scope_hint"
    | "document_type"
    | "visual_subject"
    | "system_signal";
  confidence: "low" | "medium" | "high";
}

export interface ProjectAiFileExtractionResult {
  adapter: "metadata_bootstrap" | "document_text_fetch" | "pdf_text_parse";
  status:
    | "metadata_only"
    | "extracted_text"
    | "unsupported"
    | "fetch_failed"
    | "parsed_pdf_text";
  summary: string;
  content_hints: string[];
  entities: ProjectAiFileExtractionEntity[];
  recommended_next_step: string | null;
  excerpt?: string | null;
}

export interface ProjectAiFileSignal {
  file_name?: string | null;
  file_type?: string | null;
  file_url?: string | null;
  file_kind?: ProjectAiFileKind;
  derived_tags?: string[];
  likely_item_keys?: string[];
  extraction_summary?: string | null;
  extraction_method?:
    | "filename_heuristics"
    | "metadata_bootstrap"
    | "document_text_fetch"
    | "pdf_text_parse";
  extraction_result?: ProjectAiFileExtractionResult | null;
}

export interface ProjectAiClarificationAnswerInput {
  question_key: string;
  answer_value_json: unknown;
  status?: "pending" | "answered" | "dismissed";
}

export interface ProjectAiBenchmark {
  trade: string;
  label: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface ProjectAiQuestionOption {
  id: string;
  label: string;
}

export interface ProjectAiRecommendedQuestion {
  question_key: string;
  question_text: string;
  question_type: ProjectAiClarificationQuestionType;
  help_text: string | null;
  placeholder: string | null;
  options: ProjectAiQuestionOption[];
}

export interface ProjectAiTradeBreakdownItem {
  trade: string;
  label: string;
  benchmark_count: number;
  estimated_low: number | null;
  estimated_high: number | null;
  source: "historical_bids" | "budget_signal" | "insufficient_signal";
}

export interface ProjectAiAnalysisSourceSummary {
  selectedTrades: string[];
  benchmarkTradesUsed: string[];
  answeredClarificationCount: number;
  budgetProvided: boolean;
  imageCount: number;
  videoCount: number;
  documentCount: number;
}

export interface ProjectAiAnalysisInput {
  title?: string | null;
  description?: string | null;
  completionCriteria?: string | null;
  trades?: string[];
  locationAddress?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  locationZip?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  desiredStartDate?: string | null;
  timeline?: string | null;
  files?: ProjectAiFileSignal[];
  clarificationAnswers?: ProjectAiClarificationAnswerInput[];
}

export interface ProjectAiAnalysisResult {
  status: ProjectAiEstimateStatus;
  scope_completeness_score: number;
  confidence_level: ProjectAiConfidenceLevel;
  summary: string;
  assumptions: string[];
  exclusions: string[];
  missing_items: string[];
  recommended_questions: ProjectAiRecommendedQuestion[];
  baseline_low: number | null;
  baseline_high: number | null;
  trade_breakdown: ProjectAiTradeBreakdownItem[];
  analysis_source_summary: ProjectAiAnalysisSourceSummary;
  analysis_version: string;
}

const ANALYSIS_VERSION = "v1-rules";

interface CandidateQuestion extends ProjectAiRecommendedQuestion {
  priority: number;
}

function normalizeText(value: string | null | undefined) {
  return (value || "").trim();
}

function getAnsweredValue(
  clarificationAnswers: ProjectAiClarificationAnswerInput[],
  questionKey: string
) {
  return clarificationAnswers.find(
    (entry) =>
      entry.question_key === questionKey &&
      entry.status !== "dismissed" &&
      hasMeaningfulAnswer(entry.answer_value_json)
  )?.answer_value_json;
}

function hasMeaningfulAnswer(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "boolean") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulAnswer(item));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) =>
      hasMeaningfulAnswer(item)
    );
  }

  return false;
}

function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function inferTradeFamily(trade: string) {
  const normalized = trade.toLowerCase();

  if (
    normalized.includes("electrical") ||
    normalized.includes("low_voltage") ||
    normalized.includes("fire_alarm")
  ) {
    return "electrical";
  }

  if (
    normalized.includes("plumbing") ||
    normalized.includes("sewer") ||
    normalized.includes("sprinkler")
  ) {
    return "plumbing";
  }

  if (normalized.includes("roof")) {
    return "roofing";
  }

  if (
    normalized.includes("hvac") ||
    normalized.includes("mechanical") ||
    normalized.includes("sheet_metal")
  ) {
    return "hvac";
  }

  if (
    normalized.includes("concrete") ||
    normalized.includes("masonry") ||
    normalized.includes("excavation") ||
    normalized.includes("grading")
  ) {
    return "sitework";
  }

  if (
    normalized.includes("painting") ||
    normalized.includes("wallcovering") ||
    normalized.includes("drywall")
  ) {
    return "finishes";
  }

  if (
    normalized.includes("tile") ||
    normalized.includes("flooring") ||
    normalized.includes("finish_carpentry") ||
    normalized.includes("cabinet")
  ) {
    return "interiors";
  }

  if (
    normalized.includes("landscape") ||
    normalized.includes("tree") ||
    normalized.includes("fence")
  ) {
    return "exterior";
  }

  if (
    normalized.includes("demolition") ||
    normalized.includes("hazmat") ||
    normalized.includes("cleanup")
  ) {
    return "demolition";
  }

  return "general";
}

function getTradeFamilyQuestion(
  family: string
): Omit<CandidateQuestion, "priority"> {
  switch (family) {
    case "electrical":
      return {
        question_key: "electrical_scope_details",
        question_text:
          "What electrical fixtures, circuits, panel work, or service upgrades are included?",
        question_type: "text",
        help_text:
          "Fixture counts, amperage, panel changes, and whether walls are open make electrical estimates much tighter.",
        placeholder:
          "Example: replace 18 recessed lights, add 3 new circuits, and upgrade panel from 100A to 200A.",
        options: [],
      };
    case "plumbing":
      return {
        question_key: "plumbing_scope_details",
        question_text:
          "How many fixtures, runs, or plumbing connections are part of this scope?",
        question_type: "text",
        help_text:
          "Fixture counts, access limits, and whether this is repair vs replacement are important pricing drivers.",
        placeholder:
          "Example: replace 2 toilets, 3 faucets, and rework drain lines for a kitchen sink move.",
        options: [],
      };
    case "roofing":
      return {
        question_key: "roofing_dimensions",
        question_text:
          "What are the approximate roof size, pitch, number of stories, and current roofing material?",
        question_type: "text",
        help_text:
          "Roof area, access, tear-off requirements, and material type can dramatically change the estimate range.",
        placeholder:
          "Example: 24 square asphalt shingle roof, 2 stories, tear-off and disposal included.",
        options: [],
      };
    case "hvac":
      return {
        question_key: "hvac_system_details",
        question_text:
          "What HVAC equipment or ductwork is being installed, repaired, or replaced?",
        question_type: "text",
        help_text:
          "System type, tonnage, duct changes, and equipment access are key for HVAC pricing.",
        placeholder:
          "Example: replace 3-ton heat pump and reuse existing ducts with minor sealing.",
        options: [],
      };
    case "sitework":
      return {
        question_key: "sitework_dimensions",
        question_text:
          "What are the approximate dimensions, depth/thickness, and finish requirements for this work?",
        question_type: "text",
        help_text:
          "Concrete, excavation, and masonry scopes need dimensions and finish expectations to estimate correctly.",
        placeholder:
          "Example: pour a 20x30 driveway, 4-inch slab, broom finish, with rebar.",
        options: [],
      };
    case "finishes":
      return {
        question_key: "finish_area_details",
        question_text:
          "What surfaces or rooms are included, and what prep level or finish quality is expected?",
        question_type: "text",
        help_text:
          "Room count, wall condition, and finish quality can widen or narrow the estimate significantly.",
        placeholder:
          "Example: paint 3 bedrooms and hallway, patch nail holes, premium washable eggshell finish.",
        options: [],
      };
    case "interiors":
      return {
        question_key: "interior_material_details",
        question_text:
          "What materials and approximate room dimensions are included in this interior scope?",
        question_type: "text",
        help_text:
          "Material grade, demolition needs, and room sizes are major estimate inputs for flooring, tile, and finish work.",
        placeholder:
          "Example: install 450 sq ft of LVP in living room and kitchen with new baseboards.",
        options: [],
      };
    case "exterior":
      return {
        question_key: "exterior_site_details",
        question_text:
          "What is the approximate site size and what site conditions or drainage/access issues should contractors expect?",
        question_type: "text",
        help_text:
          "Exterior work often depends on site access, slope, irrigation, and underground conflicts.",
        placeholder:
          "Example: 1,200 sq ft backyard, minor slope, irrigation stays in place, no heavy equipment access.",
        options: [],
      };
    case "demolition":
      return {
        question_key: "demolition_scope_details",
        question_text:
          "What exactly is being removed, and does the scope include haul-away, disposal, or hazardous materials?",
        question_type: "text",
        help_text:
          "Demolition pricing changes quickly based on debris volume, disposal, and potential hazardous material handling.",
        placeholder:
          "Example: remove old kitchen cabinets, countertops, and tile backsplash with haul-away included.",
        options: [],
      };
    default:
      return {
        question_key: "project_dimensions",
        question_text:
          "What are the approximate dimensions, quantities, or room counts involved in this project?",
        question_type: "text",
        help_text:
          "Measurements and counts are one of the biggest drivers of a trustworthy estimate range.",
        placeholder:
          "Example: one 8x10 bathroom, 2 vanities, 1 shower, and 140 sq ft of tile.",
        options: [],
      };
  }
}

function buildCandidateQuestions(
  input: ProjectAiAnalysisInput,
  clarificationAnswers: ProjectAiClarificationAnswerInput[],
  hasVisualMedia: boolean
) {
  const candidates: CandidateQuestion[] = [];

  const addQuestion = (
    priority: number,
    question: Omit<CandidateQuestion, "priority">
  ) => {
    if (getAnsweredValue(clarificationAnswers, question.question_key)) {
      return;
    }

    if (candidates.some((entry) => entry.question_key === question.question_key)) {
      return;
    }

    candidates.push({ ...question, priority });
  };

  if (!input.budgetMin && !input.budgetMax) {
    addQuestion(10, {
      question_key: "budget_target",
      question_text:
        "What budget range are you trying to stay within for this project?",
      question_type: "number",
      help_text:
        "A target budget helps the assistant judge whether the estimate range is directionally aligned.",
      placeholder: "Example: 15000",
      options: [],
    });
  }

  if (!normalizeText(input.timeline) && !normalizeText(input.desiredStartDate)) {
    addQuestion(20, {
      question_key: "schedule_expectations",
      question_text:
        "When do you want this project to start, and does it need to be completed by a firm deadline?",
      question_type: "text",
      help_text:
        "Timing and urgency can change pricing, crew sizing, and contractor availability.",
      placeholder:
        "Example: start within 30 days and finish before Thanksgiving.",
      options: [],
    });
  }

  addQuestion(30, {
    question_key: "material_preferences",
    question_text:
      "Do you already know the materials, finish level, or brands you want included?",
    question_type: "text",
    help_text:
      "Material quality and finish expectations are common reasons estimate ranges stay wide.",
    placeholder:
      "Example: mid-range quartz counters, matte black fixtures, and owner-supplied appliances.",
    options: [],
  });

  addQuestion(40, {
    question_key: "site_access_constraints",
    question_text:
      "Are there any site access issues, occupancy constraints, parking limits, or restricted work hours?",
    question_type: "text",
    help_text:
      "Access restrictions and occupied-site work can materially affect labor time and pricing.",
    placeholder:
      "Example: occupied home, street parking only, and work allowed after 8 AM.",
    options: [],
  });

  addQuestion(50, {
    question_key: "permit_expectations",
    question_text: "Do you expect permits or inspections to be required?",
    question_type: "single_select",
    help_text:
      "Permit and inspection expectations can change sequencing, lead time, and cost assumptions.",
    placeholder: null,
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
      { id: "not_sure", label: "Not sure" },
    ],
  });

  if (!hasVisualMedia) {
    addQuestion(60, {
      question_key: "upload_more_media",
      question_text:
        "Can you upload at least one photo or short video that shows the current site conditions?",
      question_type: "upload_request",
      help_text:
        "Visual context often removes major estimate uncertainty around access, condition, and scope boundaries.",
      placeholder: null,
      options: [],
    });
  }

  const seenFamilies = new Set<string>();
  for (const trade of input.trades || []) {
    const family = inferTradeFamily(trade);
    if (seenFamilies.has(family)) {
      continue;
    }

    seenFamilies.add(family);
    const tradeQuestion = getTradeFamilyQuestion(family);
    addQuestion(70 + seenFamilies.size, tradeQuestion);
  }

  return candidates.sort((left, right) => left.priority - right.priority);
}

function getQuestionMissingLabel(questionKey: string) {
  switch (questionKey) {
    case "budget_target":
      return "Target budget";
    case "schedule_expectations":
      return "Schedule expectations";
    case "material_preferences":
      return "Material and finish preferences";
    case "site_access_constraints":
      return "Site access and occupancy constraints";
    case "permit_expectations":
      return "Permit and inspection expectations";
    case "upload_more_media":
      return "Photos or videos of current conditions";
    case "electrical_scope_details":
      return "Electrical fixture and panel details";
    case "plumbing_scope_details":
      return "Plumbing fixture counts and scope detail";
    case "roofing_dimensions":
      return "Roof size, pitch, and material details";
    case "hvac_system_details":
      return "HVAC equipment and ductwork details";
    case "sitework_dimensions":
      return "Concrete/sitework dimensions and finish requirements";
    case "finish_area_details":
      return "Surface area and finish quality details";
    case "interior_material_details":
      return "Interior material and room-size details";
    case "exterior_site_details":
      return "Exterior site size and access details";
    case "demolition_scope_details":
      return "Demolition scope and disposal details";
    case "project_dimensions":
      return "Project dimensions or quantity counts";
    default:
      return "Additional project clarification";
  }
}

function formatClarificationAnswer(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return "";
}

function truncateAnswer(value: string, maxLength = 120) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

function roundCurrency(value: number) {
  return Math.round(value / 10) * 10;
}

function buildTradeBreakdown(
  trades: string[],
  benchmarks: ProjectAiBenchmark[],
  budgetMin: number | null,
  budgetMax: number | null,
  completenessScore: number
) {
  const tradeBreakdown: ProjectAiTradeBreakdownItem[] = [];
  const benchmarkMap = new Map(benchmarks.map((item) => [item.trade, item]));
  const matchedBenchmarks: ProjectAiBenchmark[] = [];

  for (const trade of trades) {
    const benchmark = benchmarkMap.get(trade);
    if (benchmark) {
      matchedBenchmarks.push(benchmark);
      const lowWidenFactor = completenessScore >= 80 ? 0.95 : completenessScore >= 65 ? 0.9 : 0.82;
      const highWidenFactor = completenessScore >= 80 ? 1.08 : completenessScore >= 65 ? 1.18 : 1.3;
      const estimatedLow = Math.max(benchmark.min, benchmark.avg * lowWidenFactor);
      const estimatedHigh = Math.max(benchmark.max, benchmark.avg * highWidenFactor);

      tradeBreakdown.push({
        trade,
        label: TRADE_LABELS[trade as TradeCategory] || benchmark.label || trade,
        benchmark_count: benchmark.count,
        estimated_low: roundCurrency(estimatedLow),
        estimated_high: roundCurrency(estimatedHigh),
        source: "historical_bids",
      });
      continue;
    }

    const fallbackLow =
      trades.length > 0 && budgetMin
        ? roundCurrency(budgetMin / trades.length)
        : null;
    const fallbackHigh =
      trades.length > 0
        ? roundCurrency((budgetMax || budgetMin || 0) / trades.length)
        : null;

    tradeBreakdown.push({
      trade,
      label: TRADE_LABELS[trade as TradeCategory] || trade,
      benchmark_count: 0,
      estimated_low: fallbackLow,
      estimated_high: fallbackHigh,
      source:
        fallbackLow || fallbackHigh ? "budget_signal" : "insufficient_signal",
    });
  }

  return {
    tradeBreakdown,
    matchedBenchmarks,
  };
}

function buildSummary(
  status: ProjectAiEstimateStatus,
  score: number,
  questionCount: number,
  baselineLow: number | null,
  baselineHigh: number | null
) {
  if (status === "ready" && baselineLow && baselineHigh) {
    return `The scope looks estimate-ready with a completeness score of ${score}. This baseline range is based on current scope detail, historical bid patterns, and recorded assumptions.`;
  }

  if (status === "stale") {
    return `The project changed after the last published baseline. Review the updated assumptions and refresh the estimate before sharing it with bidders again.`;
  }

  if (questionCount > 0) {
    return `The assistant can produce a directionally useful baseline now, but ${questionCount} clarification ${questionCount === 1 ? "item still needs" : "items still need"} attention to tighten confidence.`;
  }

  return `The project needs more scope detail before the estimate can be trusted. Add more specifics, media, or clarification answers to improve readiness.`;
}

export function analyzeProjectAiEstimate(
  input: ProjectAiAnalysisInput,
  benchmarks: ProjectAiBenchmark[]
): ProjectAiAnalysisResult {
  const title = normalizeText(input.title);
  const description = normalizeText(input.description);
  const completionCriteria = normalizeText(input.completionCriteria);
  const locationAddress = normalizeText(input.locationAddress);
  const locationCity = normalizeText(input.locationCity);
  const locationState = normalizeText(input.locationState);
  const locationZip = normalizeText(input.locationZip);
  const timeline = normalizeText(input.timeline);
  const desiredStartDate = normalizeText(input.desiredStartDate);
  const trades = [...new Set((input.trades || []).filter(Boolean))];
  const clarificationAnswers = input.clarificationAnswers || [];
  const files = input.files || [];

  const imageCount = files.filter((file) =>
    (file.file_type || "").startsWith("image/")
  ).length;
  const videoCount = files.filter((file) =>
    (file.file_type || "").startsWith("video/")
  ).length;
  const documentCount = Math.max(0, files.length - imageCount - videoCount);
  const hasVisualMedia = imageCount + videoCount > 0;
  const answeredClarificationCount = clarificationAnswers.filter((entry) =>
    hasMeaningfulAnswer(entry.answer_value_json)
  ).length;

  let completenessScore = 0;
  const missingItems: string[] = [];
  const assumptions: string[] = [];
  const exclusions: string[] = [
    "Final contractor pricing may change due to site conditions, permits, materials, and scheduling constraints.",
    "This baseline does not replace a binding quote, scope walk, or contractor judgment.",
  ];

  if (title.length >= 12) {
    completenessScore += 10;
  } else if (title.length > 0) {
    completenessScore += 5;
    missingItems.push("A more specific project title");
  } else {
    missingItems.push("Project title");
  }

  if (description.length >= 220) {
    completenessScore += 20;
  } else if (description.length >= 100) {
    completenessScore += 12;
    missingItems.push("A fuller project description");
  } else if (description.length > 0) {
    completenessScore += 6;
    missingItems.push("A more detailed project description");
  } else {
    missingItems.push("Project description");
  }

  if (completionCriteria.length >= 120) {
    completenessScore += 18;
  } else if (completionCriteria.length >= 60) {
    completenessScore += 10;
    missingItems.push("A more explicit completion definition");
  } else if (completionCriteria.length > 0) {
    completenessScore += 5;
    missingItems.push("Clear completion criteria");
  } else {
    missingItems.push("Completion criteria");
  }

  if (trades.length > 0) {
    completenessScore += 10;
  } else {
    missingItems.push("At least one required trade");
  }

  if (locationAddress && locationCity && locationState && locationZip) {
    completenessScore += 10;
  } else {
    missingItems.push("Complete project location");
  }

  if (desiredStartDate) {
    completenessScore += 5;
  }
  if (timeline.length >= 4) {
    completenessScore += 5;
  }
  if (!desiredStartDate && !timeline) {
    missingItems.push("Timeline or desired start date");
  }

  if (input.budgetMin && input.budgetMax) {
    completenessScore += 10;
  } else if (input.budgetMin || input.budgetMax) {
    completenessScore += 6;
  } else {
    missingItems.push("Budget target or range");
  }

  if (imageCount >= 3) {
    completenessScore += 12;
  } else if (imageCount >= 1) {
    completenessScore += 8;
  }

  if (videoCount >= 1) {
    completenessScore += 4;
  }

  if (documentCount >= 1) {
    completenessScore += 4;
  }

  if (!hasVisualMedia) {
    missingItems.push("Photos or videos showing current conditions");
  }

  completenessScore += Math.min(20, answeredClarificationCount * 4);

  const candidateQuestions = buildCandidateQuestions(
    input,
    clarificationAnswers,
    hasVisualMedia
  );
  const answeredClarificationSummaries = clarificationAnswers
    .filter(
      (entry) =>
        entry.status !== "dismissed" && hasMeaningfulAnswer(entry.answer_value_json)
    )
    .map((entry) => {
      const label = getQuestionMissingLabel(entry.question_key);
      const answer = truncateAnswer(formatClarificationAnswer(entry.answer_value_json));
      return answer ? `${label}: ${answer}` : null;
    })
    .filter((value): value is string => Boolean(value));

  const unresolvedQuestionLabels = candidateQuestions.map((question) =>
    getQuestionMissingLabel(question.question_key)
  );

  for (const label of unresolvedQuestionLabels) {
    if (!missingItems.includes(label)) {
      missingItems.push(label);
    }
  }

  const { tradeBreakdown, matchedBenchmarks } = buildTradeBreakdown(
    trades,
    benchmarks,
    input.budgetMin ?? null,
    input.budgetMax ?? null,
    completenessScore
  );

  let baselineLow: number | null = null;
  let baselineHigh: number | null = null;

  const usableTradeBreakdown = tradeBreakdown.filter(
    (item) => item.estimated_low !== null && item.estimated_high !== null
  );

  if (usableTradeBreakdown.length > 0) {
    baselineLow = roundCurrency(
      usableTradeBreakdown.reduce(
        (sum, item) => sum + (item.estimated_low || 0),
        0
      )
    );
    baselineHigh = roundCurrency(
      usableTradeBreakdown.reduce(
        (sum, item) => sum + (item.estimated_high || 0),
        0
      )
    );
  } else if (input.budgetMin || input.budgetMax) {
    const low = input.budgetMin || (input.budgetMax ? input.budgetMax * 0.8 : null);
    const high = input.budgetMax || (input.budgetMin ? input.budgetMin * 1.2 : null);
    baselineLow = low ? roundCurrency(low) : null;
    baselineHigh = high ? roundCurrency(high) : null;
  }

  if (matchedBenchmarks.length > 0) {
    assumptions.push(
      `Baseline range uses historical internal bid data for ${matchedBenchmarks.length} selected ${matchedBenchmarks.length === 1 ? "trade" : "trades"}.`
    );
  } else if (baselineLow || baselineHigh) {
    assumptions.push(
      "Baseline range leans more heavily on the customer's stated budget because internal trade benchmarks were limited."
    );
  } else {
    assumptions.push(
      "No reliable historical benchmark was available yet, so the assistant focused on scope readiness instead of pricing precision."
    );
  }

  if (!getAnsweredValue(clarificationAnswers, "permit_expectations")) {
    assumptions.push("Permit and inspection requirements are still assumed, not confirmed.");
  }
  if (!getAnsweredValue(clarificationAnswers, "material_preferences")) {
    assumptions.push("Material quality and finish level are assumed to be mid-range unless otherwise noted.");
  }
  if (!hasVisualMedia) {
    assumptions.push("The current estimate was prepared without visual verification of site conditions.");
  }
  if (answeredClarificationSummaries.length > 0) {
    assumptions.push(
      `Customer clarifications considered: ${answeredClarificationSummaries
        .slice(0, 3)
        .join(" | ")}`
    );
  }

  completenessScore = clampScore(completenessScore);

  let status: ProjectAiEstimateStatus = "ready";
  if (
    trades.length === 0 ||
    description.length < 60 ||
    completionCriteria.length < 40
  ) {
    status = "insufficient_data";
  } else if (candidateQuestions.length > 0 || completenessScore < 70) {
    status = "needs_clarification";
  }

  let confidenceLevel: ProjectAiConfidenceLevel = "low";
  if (status === "ready" && completenessScore >= 85 && matchedBenchmarks.length > 0) {
    confidenceLevel = "high";
  } else if (
    (status === "ready" || status === "needs_clarification") &&
    completenessScore >= 65
  ) {
    confidenceLevel = "medium";
  }

  const summary = buildSummary(
    status,
    completenessScore,
    candidateQuestions.length,
    baselineLow,
    baselineHigh
  );

  return {
    status,
    scope_completeness_score: completenessScore,
    confidence_level: confidenceLevel,
    summary,
    assumptions,
    exclusions,
    missing_items: missingItems,
    recommended_questions: candidateQuestions.map(({ priority, ...question }) => question),
    baseline_low: baselineLow,
    baseline_high: baselineHigh,
    trade_breakdown: tradeBreakdown,
    analysis_source_summary: {
      selectedTrades: trades,
      benchmarkTradesUsed: matchedBenchmarks.map((item) => item.trade),
      answeredClarificationCount,
      budgetProvided: Boolean(input.budgetMin || input.budgetMax),
      imageCount,
      videoCount,
      documentCount,
    },
    analysis_version: ANALYSIS_VERSION,
  };
}
