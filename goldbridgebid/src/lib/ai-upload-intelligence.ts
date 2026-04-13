import type { ProjectAiFileSignal } from "@/lib/ai-estimates";
import { extractProjectAiFile } from "@/lib/ai-upload-extractors";

type UploadKind = "image" | "video" | "document";

/**
 * General construction keyword rules for tagging uploaded files.
 * These are category-level (not project-type-specific) so they work
 * for any construction project, not just modular homes.
 */
const CATEGORY_KEYWORD_RULES: Array<{
  category: string;
  tags: string[];
  terms: string[];
}> = [
  {
    category: "site_prep",
    tags: ["site_prep", "grading", "layout"],
    terms: ["site", "prep", "grading", "grade", "gravel", "base", "layout", "footprint", "clearing"],
  },
  {
    category: "foundation",
    tags: ["foundation", "footing", "slab"],
    terms: ["foundation", "footing", "slab", "pier", "anchor", "block", "rebar", "reinforcement"],
  },
  {
    category: "demolition",
    tags: ["demolition", "removal"],
    terms: ["demo", "demolition", "removal", "tear", "strip", "haul", "dispose"],
  },
  {
    category: "electrical",
    tags: ["electrical", "panel", "wiring"],
    terms: ["electrical", "panel", "meter", "service", "amp", "conduit", "wire", "hookup", "power", "circuit", "outlet"],
  },
  {
    category: "plumbing",
    tags: ["plumbing", "pipe", "fixture"],
    terms: ["plumbing", "water", "sewer", "septic", "pipe", "drain", "fixture", "faucet", "toilet", "hookup"],
  },
  {
    category: "hvac",
    tags: ["hvac", "heating", "cooling"],
    terms: ["hvac", "heat", "cool", "furnace", "duct", "vent", "air", "conditioning", "thermostat"],
  },
  {
    category: "roofing",
    tags: ["roofing", "shingle"],
    terms: ["roof", "shingle", "gutter", "flashing", "soffit", "fascia", "ridge", "eave"],
  },
  {
    category: "framing",
    tags: ["framing", "structural"],
    terms: ["framing", "stud", "joist", "beam", "header", "truss", "rafter", "structural"],
  },
  {
    category: "concrete",
    tags: ["concrete", "flatwork"],
    terms: ["concrete", "flatwork", "driveway", "sidewalk", "curb", "pour", "slab", "form"],
  },
  {
    category: "finish",
    tags: ["finish", "interior"],
    terms: ["paint", "drywall", "tile", "flooring", "cabinet", "countertop", "trim", "molding", "finish"],
  },
  {
    category: "permits",
    tags: ["permit", "inspection"],
    terms: ["permit", "inspection", "approval", "code", "plan", "drawing", "application"],
  },
  {
    category: "landscaping",
    tags: ["landscape", "exterior"],
    terms: ["landscape", "fence", "irrigation", "lawn", "tree", "patio", "deck", "retaining"],
  },
  {
    category: "access",
    tags: ["access", "staging"],
    terms: ["access", "gate", "driveway", "staging", "delivery", "crane", "route"],
  },
];

function inferUploadKind(file: Pick<ProjectAiFileSignal, "file_name" | "file_type">): UploadKind {
  const type = (file.file_type || "").toLowerCase();
  const name = (file.file_name || "").toLowerCase();

  if (
    type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(name)
  ) {
    return "image";
  }

  if (
    type.startsWith("video/") ||
    /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(name)
  ) {
    return "video";
  }

  return "document";
}

function normalizeFileText(file: Pick<ProjectAiFileSignal, "file_name" | "file_type">) {
  return `${file.file_name || ""} ${file.file_type || ""}`.toLowerCase();
}

function buildExtractionSummary(params: {
  fileKind: UploadKind;
  matchedTags: string[];
  likelyItemKeys: string[];
}) {
  const { fileKind, matchedTags, likelyItemKeys } = params;
  const kindLabel =
    fileKind === "image" ? "image" : fileKind === "video" ? "video" : "document";

  if (likelyItemKeys.length > 0 && matchedTags.length > 0) {
    return `Derived ${kindLabel} intent suggests ${matchedTags.join(", ")} evidence for ${likelyItemKeys.length} likely scope item(s).`;
  }

  if (matchedTags.length > 0) {
    return `Derived ${kindLabel} intent suggests ${matchedTags.join(", ")} evidence.`;
  }

  return `Derived ${kindLabel} intent is currently generic and not yet tied to a specific scope item.`;
}

export async function enrichProjectAiFileSignal(
  file: Pick<ProjectAiFileSignal, "file_name" | "file_type" | "file_url">
): Promise<ProjectAiFileSignal> {
  const fileKind = inferUploadKind(file);
  const normalized = normalizeFileText(file);
  const matchedTags = new Set<string>();
  const likelyItemKeys = new Set<string>();

  for (const rule of CATEGORY_KEYWORD_RULES) {
    if (rule.terms.some((term) => normalized.includes(term))) {
      likelyItemKeys.add(rule.category);
      for (const tag of rule.tags) {
        matchedTags.add(tag);
      }
    }
  }

  if (fileKind === "image" || fileKind === "video") {
    matchedTags.add("visual_evidence");
  } else {
    matchedTags.add("document_evidence");
  }

  const extractionResult = await extractProjectAiFile({
    file,
    fileKind,
    derivedTags: Array.from(matchedTags),
    likelyItemKeys: Array.from(likelyItemKeys),
  });

  return {
    file_name: file.file_name || null,
    file_type: file.file_type || null,
    file_url: file.file_url || null,
    file_kind: fileKind,
    derived_tags: Array.from(matchedTags),
    likely_item_keys: Array.from(likelyItemKeys),
    extraction_result: extractionResult,
    extraction_summary: buildExtractionSummary({
      fileKind,
      matchedTags: Array.from(matchedTags),
      likelyItemKeys: Array.from(likelyItemKeys),
    }),
    extraction_method: extractionResult.adapter,
  };
}

export async function enrichProjectAiFileSignals(
  files: Array<Pick<ProjectAiFileSignal, "file_name" | "file_type" | "file_url">>
) {
  return Promise.all(files.map((file) => enrichProjectAiFileSignal(file)));
}
