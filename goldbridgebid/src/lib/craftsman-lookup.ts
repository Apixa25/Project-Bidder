/**
 * Craftsman National Construction Estimator — lookup module.
 *
 * Loads the parsed JSON (17,500+ line items) and provides fast search
 * so the AI prompts and scope-item builder can reference real published
 * unit costs instead of guessing.
 *
 * The JSON file is loaded once and cached in memory for the lifetime
 * of the Node.js process (~4.8 MB — well within server limits).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CraftsmanItem {
  description: string;
  craft_code: string | null;
  manhours: number | null;
  unit: string;
  material: number | null;
  labor: number | null;
  equipment: number | null;
  total: number | null;
}

export interface CraftsmanSection {
  section: string;
  division: string;
  item_count: number;
  items: CraftsmanItem[];
}

interface CraftsmanData {
  source: string;
  parsed_at: string;
  total_items: number;
  total_sections: number;
  sections: CraftsmanSection[];
}

export interface CraftsmanSearchResult {
  section: string;
  division: string;
  item: CraftsmanItem;
  relevance_score: number;
}

export interface CraftsmanCostContext {
  items: CraftsmanSearchResult[];
  summary_text: string;
}

// ---------------------------------------------------------------------------
// Data loading (lazy singleton)
// ---------------------------------------------------------------------------

let cachedData: CraftsmanData | null = null;

function loadData(): CraftsmanData {
  if (cachedData) return cachedData;

  const filePath = join(
    process.cwd(),
    "data",
    "craftsman-nce-parsed.json"
  );

  try {
    const raw = readFileSync(filePath, "utf-8");
    cachedData = JSON.parse(raw) as CraftsmanData;
    console.log(
      `[craftsman-lookup] Loaded ${cachedData.total_items} items from ${cachedData.total_sections} sections.`
    );
    return cachedData;
  } catch (err) {
    console.warn("[craftsman-lookup] Could not load Craftsman data:", err);
    cachedData = {
      source: "unavailable",
      parsed_at: "",
      total_items: 0,
      total_sections: 0,
      sections: [],
    };
    return cachedData;
  }
}

// ---------------------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s/'".-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function scoreMatch(
  sectionTokens: string[],
  itemTokens: string[],
  queryTokens: string[]
): number {
  let score = 0;
  const allTargetTokens = [...sectionTokens, ...itemTokens];

  for (const qt of queryTokens) {
    for (const tt of allTargetTokens) {
      if (tt === qt) {
        score += 3;
      } else if (tt.startsWith(qt) || qt.startsWith(tt)) {
        score += 2;
      } else if (tt.includes(qt) || qt.includes(tt)) {
        score += 1;
      }
    }
  }

  if (score > 0) {
    const matchRatio = score / (queryTokens.length * 3);
    score = Math.round(matchRatio * 100);
  }

  return score;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search for Craftsman line items matching a keyword query.
 * Returns top results sorted by relevance.
 */
export function searchCraftsmanItems(
  query: string,
  options: {
    maxResults?: number;
    division?: "Residential" | "Industrial & Commercial";
    minScore?: number;
  } = {}
): CraftsmanSearchResult[] {
  const { maxResults = 15, division, minScore = 20 } = options;
  const data = loadData();
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) return [];

  const results: CraftsmanSearchResult[] = [];

  for (const section of data.sections) {
    if (division && section.division !== division) continue;

    const sectionTokens = tokenize(section.section);

    for (const item of section.items) {
      if (item.total === null && item.material === null) continue;

      const itemTokens = tokenize(item.description);
      const score = scoreMatch(sectionTokens, itemTokens, queryTokens);

      if (score >= minScore) {
        results.push({
          section: section.section,
          division: section.division,
          item,
          relevance_score: score,
        });
      }
    }
  }

  results.sort((a, b) => b.relevance_score - a.relevance_score);
  return results.slice(0, maxResults);
}

/**
 * Look up Craftsman items for a specific scope item category.
 * Maps our internal categories to relevant Craftsman search terms.
 */
const CATEGORY_SEARCH_MAP: Record<string, string[]> = {
  site_prep: ["site preparation", "clearing", "grading", "excavation"],
  demolition: ["demolition", "removal", "tear out"],
  excavation: ["excavation", "trenching", "backfill", "grading"],
  foundation: ["foundation", "footing", "slab", "concrete footing"],
  concrete: ["concrete", "formwork", "reinforcing", "rebar"],
  masonry: ["masonry", "brick", "block", "mortar", "stone"],
  structural: ["structural steel", "beam", "column", "joist"],
  framing: ["framing", "lumber", "stud", "joist", "rafter", "sheathing"],
  roofing: ["roofing", "shingle", "flashing", "underlayment", "roof"],
  electrical: ["electrical", "wiring", "outlet", "panel", "circuit", "switch"],
  plumbing: ["plumbing", "pipe", "fixture", "faucet", "drain", "water heater"],
  hvac: ["heating", "cooling", "ductwork", "furnace", "air conditioning", "thermostat"],
  insulation: ["insulation", "batt", "blown", "foam", "vapor barrier"],
  drywall: ["drywall", "gypsum", "taping", "texture", "joint compound"],
  painting: ["painting", "primer", "paint", "stain", "coating"],
  flooring: ["flooring", "hardwood", "laminate", "vinyl", "carpet", "tile floor"],
  tile: ["tile", "ceramic", "porcelain", "grout", "backsplash"],
  cabinetry: ["cabinet", "countertop", "vanity", "kitchen cabinet"],
  windows_doors: ["window", "door", "sliding door", "entry door", "skylight"],
  siding_exterior: ["siding", "stucco", "trim", "fascia", "soffit"],
  waterproofing: ["waterproofing", "membrane", "sealant", "caulking"],
  landscaping: ["landscaping", "sod", "planting", "irrigation", "fence"],
  permits_inspections: ["permit", "inspection"],
  cleanup: ["cleanup", "disposal", "dumpster", "hauling"],
  materials_delivery: ["delivery", "crane", "scaffolding"],
  general_labor: ["labor", "helper", "general"],
  safety: ["safety", "barricade", "protection"],
  finish: ["finish", "trim", "molding", "hardware", "accessory"],
};

export function lookupByCategory(
  category: string,
  options: {
    maxResults?: number;
    division?: "Residential" | "Industrial & Commercial";
  } = {}
): CraftsmanSearchResult[] {
  const searchTerms = CATEGORY_SEARCH_MAP[category];
  if (!searchTerms) return [];

  const allResults: CraftsmanSearchResult[] = [];
  const seenDescriptions = new Set<string>();

  for (const term of searchTerms) {
    const termResults = searchCraftsmanItems(term, {
      maxResults: options.maxResults || 8,
      division: options.division,
      minScore: 15,
    });

    for (const result of termResults) {
      const key = `${result.section}::${result.item.description}`;
      if (!seenDescriptions.has(key)) {
        seenDescriptions.add(key);
        allResults.push(result);
      }
    }
  }

  allResults.sort((a, b) => b.relevance_score - a.relevance_score);
  return allResults.slice(0, options.maxResults || 10);
}

/**
 * Given a project description and a list of scope item categories,
 * build a compact cost context string that can be injected into an
 * LLM prompt. This gives the AI real published costs to reference.
 */
export function buildCraftsmanCostContext(params: {
  projectDescription: string;
  categories: string[];
  sector: "residential" | "commercial" | "industrial" | "infrastructure" | "mixed";
  maxItemsPerCategory?: number;
  maxTotalItems?: number;
}): CraftsmanCostContext {
  const {
    categories,
    sector,
    maxItemsPerCategory = 6,
    maxTotalItems = 40,
  } = params;

  const division: "Residential" | "Industrial & Commercial" | undefined =
    sector === "residential" ? "Residential" :
    sector === "commercial" || sector === "industrial" ? "Industrial & Commercial" :
    undefined;

  const allItems: CraftsmanSearchResult[] = [];
  const seenKeys = new Set<string>();

  for (const category of categories) {
    const catResults = lookupByCategory(category, {
      maxResults: maxItemsPerCategory,
      division,
    });

    for (const result of catResults) {
      const key = `${result.section}::${result.item.description}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allItems.push(result);
      }
    }
  }

  allItems.sort((a, b) => b.relevance_score - a.relevance_score);
  const topItems = allItems.slice(0, maxTotalItems);

  if (topItems.length === 0) {
    return {
      items: [],
      summary_text:
        "No matching reference costs found in the Craftsman National Construction Estimator.",
    };
  }

  const lines = [
    "REFERENCE COST DATA from the 2023 National Construction Estimator (Craftsman Book Company).",
    "These are published 2023 unit costs for general contractors. Use them as reference points — do NOT copy them verbatim as estimates.",
    "Actual project costs depend on location, site conditions, quantities, and material selections.",
    "",
  ];

  let currentSection = "";
  for (const result of topItems) {
    if (result.section !== currentSection) {
      currentSection = result.section;
      lines.push(`[${result.section}]`);
    }

    const i = result.item;
    const parts = [`  ${i.description}`];

    if (i.craft_code && i.manhours !== null) {
      parts.push(`${i.craft_code}@${i.manhours}hrs`);
    }

    parts.push(`per ${i.unit}`);

    const costParts: string[] = [];
    if (i.material !== null) costParts.push(`Mat:$${i.material}`);
    if (i.labor !== null) costParts.push(`Lab:$${i.labor}`);
    if (i.equipment !== null) costParts.push(`Equip:$${i.equipment}`);
    if (i.total !== null) costParts.push(`Total:$${i.total}`);
    parts.push(costParts.join(" "));

    lines.push(parts.join(" | "));
  }

  return {
    items: topItems,
    summary_text: lines.join("\n"),
  };
}

/**
 * Quick search for items matching a specific scope item description.
 * Used after classification to attach Craftsman reference costs to
 * individual scope item cards.
 */
export function findCraftsmanCostsForScopeItem(params: {
  itemLabel: string;
  itemCategory: string;
  sector?: "residential" | "commercial" | "industrial" | "infrastructure" | "mixed";
  maxResults?: number;
}): CraftsmanSearchResult[] {
  const { itemLabel, itemCategory, sector, maxResults = 5 } = params;

  const division: "Residential" | "Industrial & Commercial" | undefined =
    sector === "residential" ? "Residential" :
    sector === "commercial" || sector === "industrial" ? "Industrial & Commercial" :
    undefined;

  // Search by item label directly
  const labelResults = searchCraftsmanItems(itemLabel, {
    maxResults,
    division,
    minScore: 15,
  });

  // If not enough results, also search by category
  if (labelResults.length < 2) {
    const catResults = lookupByCategory(itemCategory, {
      maxResults: maxResults - labelResults.length,
      division,
    });

    const seenKeys = new Set(
      labelResults.map((r) => `${r.section}::${r.item.description}`)
    );
    for (const r of catResults) {
      const key = `${r.section}::${r.item.description}`;
      if (!seenKeys.has(key)) {
        labelResults.push(r);
        seenKeys.add(key);
      }
    }
  }

  return labelResults.slice(0, maxResults);
}

/**
 * Format Craftsman cost data for a single scope item as quantity drivers
 * that can be displayed in the UI.
 */
export function formatCraftsmanAsQuantityDrivers(
  results: CraftsmanSearchResult[]
): Array<{
  key: string;
  label: string;
  value: string;
  unit: string | null;
  confidence: "low" | "medium" | "high";
  source: "trade_history";
}> {
  return results.slice(0, 3).map((r, idx) => {
    const i = r.item;
    const costStr = i.total !== null ? `$${i.total}` : i.material !== null ? `$${i.material} (material)` : "see reference";
    const laborStr = i.manhours !== null ? ` | ${i.manhours}hrs labor` : "";

    return {
      key: `craftsman_ref_${idx}`,
      label: `Craftsman 2023: ${i.description}`,
      value: `${costStr}/${i.unit}${laborStr}`,
      unit: i.unit,
      confidence: "medium" as const,
      source: "trade_history" as const,
    };
  });
}
