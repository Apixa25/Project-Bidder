import type {
  ProjectAiFileExtractionEntity,
  ProjectAiFileExtractionResult,
  ProjectAiFileKind,
  ProjectAiFileSignal,
} from "@/lib/ai-estimates";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";

const TEXT_DOCUMENT_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".tsv",
  ".json",
  ".jsonl",
  ".yaml",
  ".yml",
  ".xml",
  ".log",
];
const PDF_DOCUMENT_EXTENSIONS = [".pdf"];
const IMAGE_DOCUMENT_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".bmp",
  ".gif",
  ".tif",
  ".tiff",
];

const TEXT_HINT_RULES: Array<{ label: string; terms: string[] }> = [
  { label: "electrical scope", terms: ["panel", "meter", "service", "amp", "conduit", "electrical"] },
  { label: "utility scope", terms: ["water", "sewer", "septic", "stub", "utility", "hookup"] },
  { label: "grading/drainage scope", terms: ["grading", "drainage", "runoff", "erosion", "slope"] },
  { label: "permit/approval scope", terms: ["permit", "inspection", "approval", "code", "jurisdiction"] },
  { label: "delivery/access scope", terms: ["delivery", "access", "gate", "staging", "route", "crane"] },
  { label: "foundation scope", terms: ["foundation", "pier", "anchor", "slab", "engineering"] },
];

function getKindLabel(kind: ProjectAiFileKind) {
  switch (kind) {
    case "image":
      return "image";
    case "video":
      return "video";
    default:
      return "document";
  }
}

function getRecommendedNextStep(params: {
  kind: ProjectAiFileKind;
  likelyItemKeys: string[];
  fileName: string;
}) {
  const { kind, likelyItemKeys } = params;

  if (likelyItemKeys.includes("electrical_service_upgrade")) {
    return kind === "document"
      ? "Add any panel schedule, service notes, or utility paperwork that confirms electrical requirements."
      : "Add clearer panel, meter, or hookup-path coverage if available.";
  }

  if (likelyItemKeys.includes("modular_delivery_set_logistics")) {
    return "Add route, gate, and staging coverage that shows how the unit would reach the final set location.";
  }

  if (likelyItemKeys.includes("grading_and_drainage")) {
    return "Add wider before/after-rain views or supporting site notes to clarify slope and runoff conditions.";
  }

  if (kind === "document") {
    return "Add more item-specific plans, marked-up sketches, or approval documents if available.";
  }

  return "Add more item-specific uploads if you want the estimator to tighten this scope further.";
}

function looksTextExtractable(file: Pick<ProjectAiFileSignal, "file_name" | "file_type" | "file_url">) {
  if (!file.file_url) {
    return false;
  }

  const fileName = (file.file_name || "").toLowerCase();
  const fileType = (file.file_type || "").toLowerCase();

  return (
    TEXT_DOCUMENT_EXTENSIONS.some((extension) => fileName.endsWith(extension)) ||
    fileType.startsWith("text/") ||
    fileType.includes("json") ||
    fileType.includes("xml") ||
    fileType.includes("yaml")
  );
}

function looksPdfExtractable(file: Pick<ProjectAiFileSignal, "file_name" | "file_type" | "file_url">) {
  if (!file.file_url) {
    return false;
  }

  const fileName = (file.file_name || "").toLowerCase();
  const fileType = (file.file_type || "").toLowerCase();

  return (
    PDF_DOCUMENT_EXTENSIONS.some((extension) => fileName.endsWith(extension)) ||
    fileType.includes("pdf")
  );
}

function looksImageOcrExtractable(
  file: Pick<ProjectAiFileSignal, "file_name" | "file_type" | "file_url">
) {
  if (!file.file_url) {
    return false;
  }

  const fileName = (file.file_name || "").toLowerCase();
  const fileType = (file.file_type || "").toLowerCase();

  return (
    IMAGE_DOCUMENT_EXTENSIONS.some((extension) => fileName.endsWith(extension)) ||
    fileType.startsWith("image/")
  );
}

function normalizeExtractedText(text: string) {
  return text.replace(/\0/g, " ").replace(/\s+/g, " ").trim();
}

function buildExtractedTextHints(text: string) {
  const normalized = text.toLowerCase();
  const hints = new Set<string>();

  for (const rule of TEXT_HINT_RULES) {
    if (rule.terms.some((term) => normalized.includes(term))) {
      hints.add(rule.label);
    }
  }

  return Array.from(hints);
}

async function runOcrOnImageBuffer(buffer: Buffer) {
  const worker = await createWorker("eng", 1, {
    logger: () => {},
  });

  try {
    const result = await worker.recognize(buffer);
    return normalizeExtractedText(result.data.text || "");
  } finally {
    await worker.terminate();
  }
}

function buildExtractionEntities(params: {
  metadataEntities: ProjectAiFileExtractionEntity[];
  extractedHints: string[];
}) {
  return [
    ...params.metadataEntities,
    ...params.extractedHints.map((hint) => ({
      label: hint,
      kind: "scope_hint" as const,
      confidence: "medium" as const,
    })),
  ];
}

function buildEntities(params: {
  fileKind: ProjectAiFileKind;
  derivedTags: string[];
  likelyItemKeys: string[];
}): ProjectAiFileExtractionEntity[] {
  const entities: ProjectAiFileExtractionEntity[] = [];
  const { fileKind, derivedTags, likelyItemKeys } = params;

  entities.push({
    label:
      fileKind === "image"
        ? "Visual upload"
        : fileKind === "video"
          ? "Walkthrough-style upload"
          : "Document upload",
    kind: fileKind === "document" ? "document_type" : "visual_subject",
    confidence: "medium",
  });

  for (const tag of derivedTags.slice(0, 5)) {
    entities.push({
      label: tag.replaceAll("_", " "),
      kind: tag.includes("evidence") ? "system_signal" : "scope_hint",
      confidence: tag.includes("evidence") ? "high" : "medium",
    });
  }

  for (const itemKey of likelyItemKeys.slice(0, 3)) {
    entities.push({
      label: itemKey.replaceAll("_", " "),
      kind: "scope_hint",
      confidence: "high",
    });
  }

  return entities;
}

export function extractProjectAiFileMetadata(params: {
  file: Pick<ProjectAiFileSignal, "file_name" | "file_type">;
  fileKind: ProjectAiFileKind;
  derivedTags: string[];
  likelyItemKeys: string[];
}): ProjectAiFileExtractionResult {
  const { file, fileKind, derivedTags, likelyItemKeys } = params;
  const fileName = file.file_name || "unnamed file";
  const kindLabel = getKindLabel(fileKind);

  const summary =
    likelyItemKeys.length > 0
      ? `Metadata adapter interprets "${fileName}" as a ${kindLabel} that may support ${likelyItemKeys.length} scope item(s).`
      : `Metadata adapter interprets "${fileName}" as a generic ${kindLabel} upload with no strong item match yet.`;

  const contentHints = Array.from(
    new Set([
      ...derivedTags,
      ...likelyItemKeys.map((itemKey) => itemKey.replaceAll("_", " ")),
      `kind:${fileKind}`,
    ])
  );

  return {
    adapter: "metadata_bootstrap",
    status: "metadata_only",
    summary,
    content_hints: contentHints,
    entities: buildEntities({
      fileKind,
      derivedTags,
      likelyItemKeys,
    }),
    recommended_next_step: getRecommendedNextStep({
      kind: fileKind,
      likelyItemKeys,
      fileName,
    }),
    excerpt: null,
  };
}

export async function extractProjectAiFile(params: {
  file: Pick<ProjectAiFileSignal, "file_name" | "file_type" | "file_url">;
  fileKind: ProjectAiFileKind;
  derivedTags: string[];
  likelyItemKeys: string[];
}): Promise<ProjectAiFileExtractionResult> {
  const metadataResult = extractProjectAiFileMetadata(params);

  if (params.fileKind === "image" && looksImageOcrExtractable(params.file)) {
    try {
      const response = await fetch(params.file.file_url!, {
        cache: "no-store",
      });

      if (!response.ok) {
        return {
          ...metadataResult,
          adapter: "image_ocr_parse",
          status: "fetch_failed",
          summary: `The OCR adapter could not read "${params.file.file_name || "image"}" because the file fetch returned ${response.status}.`,
          recommended_next_step:
            "Verify the image URL is reachable and retry, or upload a clearer image if OCR is important here.",
        };
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const text = await runOcrOnImageBuffer(buffer);

      if (text.length === 0) {
        return {
          ...metadataResult,
          adapter: "image_ocr_parse",
          status: "fetch_failed",
          summary: `The OCR adapter opened "${params.file.file_name || "image"}" but did not find readable text.`,
          recommended_next_step:
            "Upload a sharper, higher-contrast image or a text/PDF version of the document if available.",
        };
      }

      const excerpt = text.slice(0, 320);
      const extractedHints = buildExtractedTextHints(text).slice(0, 6);
      const entities = buildExtractionEntities({
        metadataEntities: metadataResult.entities,
        extractedHints,
      });

      return {
        adapter: "image_ocr_parse",
        status: "parsed_ocr_text",
        summary: `The OCR adapter read "${params.file.file_name || "image"}" and extracted text${extractedHints.length > 0 ? " with scope-related hints" : ""}.`,
        content_hints: Array.from(
          new Set([...metadataResult.content_hints, ...extractedHints, "ocr_text_extracted"])
        ),
        entities,
        recommended_next_step:
          extractedHints.length > 0
            ? metadataResult.recommended_next_step
            : "OCR found readable text, but it still looks generic. Add a more item-specific image or supporting note if available.",
        excerpt,
      };
    } catch {
      return {
        ...metadataResult,
        adapter: "image_ocr_parse",
        status: "fetch_failed",
        summary: `The OCR adapter hit an error while trying to read "${params.file.file_name || "image"}".`,
        recommended_next_step:
          "Retry later or upload a cleaner image if you want OCR help on this file.",
      };
    }
  }

  if (params.fileKind !== "document") {
    return metadataResult;
  }

  if (looksPdfExtractable(params.file)) {
    try {
      const response = await fetch(params.file.file_url!, {
        cache: "no-store",
      });

      if (!response.ok) {
        return {
          ...metadataResult,
          adapter: "pdf_text_parse",
          status: "fetch_failed",
          summary: `The PDF adapter could not read "${params.file.file_name || "document"}" because the file fetch returned ${response.status}.`,
          recommended_next_step:
            "Verify the PDF URL is reachable and retry, or upload a text-based companion document.",
        };
      }

      const buffer = await response.arrayBuffer();
      const parser = new PDFParse({
        data: new Uint8Array(buffer),
      });

      try {
        const textResult = await parser.getText();
        const text = normalizeExtractedText(textResult.text || "");

        if (text.length > 0) {
          const excerpt = text.slice(0, 320);
          const extractedHints = buildExtractedTextHints(text).slice(0, 6);
          const entities = buildExtractionEntities({
            metadataEntities: metadataResult.entities,
            extractedHints,
          });

          return {
            adapter: "pdf_text_parse",
            status: "parsed_pdf_text",
            summary: `The PDF adapter read "${params.file.file_name || "document"}" and extracted ${textResult.total} page(s) of text${extractedHints.length > 0 ? " with scope-related hints" : ""}.`,
            content_hints: Array.from(
              new Set([...metadataResult.content_hints, ...extractedHints, "pdf_text_extracted"])
            ),
            entities,
            recommended_next_step:
              extractedHints.length > 0
                ? metadataResult.recommended_next_step
                : "The PDF text was readable, but still generic. Add a more item-specific marked-up plan or supporting note if available.",
            excerpt,
          };
        }

        const screenshotResult = await parser.getScreenshot({
          first: 2,
          imageBuffer: true,
          imageDataUrl: false,
          desiredWidth: 1600,
        });

        const ocrTexts: string[] = [];
        for (const page of screenshotResult.pages) {
          const pageText = await runOcrOnImageBuffer(Buffer.from(page.data));
          if (pageText.length > 0) {
            ocrTexts.push(pageText);
          }
        }

        const combinedOcrText = normalizeExtractedText(ocrTexts.join("\n\n"));
        if (combinedOcrText.length === 0) {
          return {
            ...metadataResult,
            adapter: "pdf_ocr_parse",
            status: "fetch_failed",
            summary: `The scanned PDF OCR adapter opened "${params.file.file_name || "document"}" but did not recover readable OCR text from the first pages.`,
            recommended_next_step:
              "Upload a cleaner scan, higher-resolution PDF, or a text companion note if available.",
          };
        }

        const excerpt = combinedOcrText.slice(0, 320);
        const extractedHints = buildExtractedTextHints(combinedOcrText).slice(0, 6);
        const entities = buildExtractionEntities({
          metadataEntities: metadataResult.entities,
          extractedHints,
        });

        return {
          adapter: "pdf_ocr_parse",
          status: "parsed_pdf_ocr_text",
          summary: `The scanned PDF OCR adapter rendered and read up to ${screenshotResult.total} page(s) from "${params.file.file_name || "document"}"${extractedHints.length > 0 ? " with scope-related hints" : ""}.`,
          content_hints: Array.from(
            new Set([...metadataResult.content_hints, ...extractedHints, "pdf_ocr_text_extracted"])
          ),
          entities,
          recommended_next_step:
            extractedHints.length > 0
              ? metadataResult.recommended_next_step
              : "OCR recovered some PDF text, but it still looks generic. Add a marked-up page or supporting text note if available.",
          excerpt,
        };
      } finally {
        await parser.destroy();
      }
    } catch {
      return {
        ...metadataResult,
        adapter: "pdf_ocr_parse",
        status: "fetch_failed",
        summary: `The PDF extraction pipeline hit an error while trying to parse "${params.file.file_name || "document"}".`,
        recommended_next_step:
          "Retry later or upload a simpler companion text document if you want extraction help on this file now.",
      };
    }
  }

  if (!looksTextExtractable(params.file)) {
    return {
      ...metadataResult,
      adapter: "document_text_fetch",
      status: "unsupported",
      summary: `${params.file.file_name || "This document"} is not a supported text-extractable document type yet, so the adapter fell back to metadata-only interpretation.`,
      recommended_next_step:
        "Upload a text-like document, PDF parser support, or OCR adapter in a future pass to extract richer content from this file.",
    };
  }

  try {
    const response = await fetch(params.file.file_url!, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ...metadataResult,
        adapter: "document_text_fetch",
        status: "fetch_failed",
        summary: `The extractor could not read "${params.file.file_name || "document"}" because the file fetch returned ${response.status}.`,
        recommended_next_step:
          "Verify the document URL is reachable and retry, or upload a text-based version of the file.",
      };
    }

    const text = normalizeExtractedText(await response.text());
    if (text.length === 0) {
      return {
        ...metadataResult,
        adapter: "document_text_fetch",
        status: "fetch_failed",
        summary: `The extractor reached "${params.file.file_name || "document"}" but did not find readable text content.`,
        recommended_next_step:
          "Upload a text-based document or add OCR support for scanned/image-based files.",
      };
    }

    const excerpt = text.slice(0, 320);
    const extractedHints = buildExtractedTextHints(text).slice(0, 6);
    const entities = buildExtractionEntities({
      metadataEntities: metadataResult.entities,
      extractedHints,
    });

    return {
      adapter: "document_text_fetch",
      status: "extracted_text",
      summary: `The text extraction adapter read "${params.file.file_name || "document"}" and found ${extractedHints.length > 0 ? "scope-related text hints" : "readable text content"}.`,
      content_hints: Array.from(
        new Set([...metadataResult.content_hints, ...extractedHints, "text_extracted"])
      ),
      entities,
      recommended_next_step:
        extractedHints.length > 0
          ? metadataResult.recommended_next_step
          : "The document text was readable, but still fairly generic. Add a more item-specific note, plan, or marked-up document if available.",
      excerpt,
    };
  } catch {
    return {
      ...metadataResult,
      adapter: "document_text_fetch",
      status: "fetch_failed",
      summary: `The extractor hit an error while trying to read "${params.file.file_name || "document"}".`,
      recommended_next_step:
        "Retry later or upload a simpler text-based document if you want content extraction on this file.",
    };
  }
}
