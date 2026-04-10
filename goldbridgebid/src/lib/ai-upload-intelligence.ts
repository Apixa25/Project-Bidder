import type { ProjectAiFileSignal } from "@/lib/ai-estimates";
import { extractProjectAiFile } from "@/lib/ai-upload-extractors";

type UploadKind = "image" | "video" | "document";

const ITEM_KEYWORD_RULES: Array<{
  itemKey: string;
  tags: string[];
  terms: string[];
}> = [
  {
    itemKey: "modular_site_prep",
    tags: ["site_prep", "pad", "grading", "layout"],
    terms: ["site", "pad", "prep", "grading", "grade", "gravel", "base", "layout", "footprint"],
  },
  {
    itemKey: "modular_foundation_support",
    tags: ["foundation", "anchoring", "engineering"],
    terms: ["foundation", "pier", "anchor", "anchoring", "slab", "engineering", "tie down"],
  },
  {
    itemKey: "modular_delivery_set_logistics",
    tags: ["delivery", "access", "staging"],
    terms: ["delivery", "set", "crane", "access", "route", "staging", "turn", "turnaround"],
  },
  {
    itemKey: "electrical_service_upgrade",
    tags: ["electrical", "service", "panel", "meter"],
    terms: ["electrical", "panel", "meter", "service", "amp", "conduit", "trench", "hookup", "power"],
  },
  {
    itemKey: "utility_tie_in_verification",
    tags: ["utility", "water", "sewer", "hookup"],
    terms: ["utility", "water", "sewer", "septic", "plumbing", "stub", "hookup", "connection", "tie in"],
  },
  {
    itemKey: "grading_and_drainage",
    tags: ["grading", "drainage", "erosion"],
    terms: ["grading", "grade", "drainage", "drain", "erosion", "runoff", "slope", "gravel"],
  },
  {
    itemKey: "permit_and_inspection_coordination",
    tags: ["permit", "inspection", "plan", "code"],
    terms: ["permit", "inspection", "approval", "code", "plan", "drawing", "application", "site plan"],
  },
  {
    itemKey: "site_access_logistics",
    tags: ["access", "driveway", "gate", "staging"],
    terms: ["access", "gate", "driveway", "road", "entry", "path", "staging", "turnaround"],
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

  for (const rule of ITEM_KEYWORD_RULES) {
    if (rule.terms.some((term) => normalized.includes(term))) {
      likelyItemKeys.add(rule.itemKey);
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
