import { z } from "zod";

const SCOPE_ITEM_CATEGORIES = [
  "site_prep",
  "demolition",
  "excavation",
  "foundation",
  "concrete",
  "masonry",
  "structural",
  "framing",
  "roofing",
  "electrical",
  "plumbing",
  "hvac",
  "insulation",
  "drywall",
  "painting",
  "flooring",
  "tile",
  "cabinetry",
  "windows_doors",
  "siding_exterior",
  "waterproofing",
  "landscaping",
  "permits_inspections",
  "cleanup",
  "materials_delivery",
  "general_labor",
  "safety",
  "finish",
  "other",
] as const;

export type AiScopeItemCategory = (typeof SCOPE_ITEM_CATEGORIES)[number];

const INCLUSION_LEVELS = [
  "required",
  "recommended",
  "optional",
  "conditional",
] as const;

const COST_SIGNIFICANCE_LEVELS = ["high", "medium", "low"] as const;

const GAP_SEVERITY_LEVELS = ["critical", "important", "nice_to_have"] as const;

export const classifyRequirementSchema = z.object({
  item_key: z.string().trim().min(1).max(80),
  item_label: z.string().trim().min(1).max(120),
  category: z.enum(SCOPE_ITEM_CATEGORIES),
  description: z.string().trim().min(1).max(500),
  why_standard: z.string().trim().min(1).max(500),
  is_mentioned_by_customer: z.boolean(),
  mention_summary: z.string().trim().max(500).nullable(),
  recommended_inclusion: z.enum(INCLUSION_LEVELS),
  typical_cost_significance: z.enum(COST_SIGNIFICANCE_LEVELS),
  customer_stated_quantity: z.number().nullable(),
  customer_stated_unit: z.string().trim().max(60).nullable(),
  quantity_note: z.string().trim().max(500).nullable(),
});

export const classifyScopeGapSchema = z.object({
  description: z.string().trim().min(1).max(500),
  severity: z.enum(GAP_SEVERITY_LEVELS),
  suggestion: z.string().trim().min(1).max(500),
});

export const classifyQuestionOptionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
});

export const classifyQuestionSchema = z.object({
  question_key: z.string().trim().min(1).max(80),
  question_text: z.string().trim().min(1).max(240),
  question_type: z.enum([
    "single_select",
    "multi_select",
    "number",
    "text",
    "upload_request",
  ]),
  help_text: z.string().trim().max(280).nullable(),
  placeholder: z.string().trim().max(180).nullable(),
  options: z.array(classifyQuestionOptionSchema).max(8),
});

export const projectAiClassifyOutputSchema = z.object({
  project_classification: z.object({
    project_type_key: z.string().trim().min(1).max(80),
    project_type_label: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(600),
    construction_sector: z.enum([
      "residential",
      "commercial",
      "industrial",
      "infrastructure",
      "mixed",
    ]),
    complexity_level: z.enum(["simple", "moderate", "complex"]),
  }),
  standard_requirements: z.array(classifyRequirementSchema).min(1).max(30),
  scope_gaps: z.array(classifyScopeGapSchema).max(10),
  customer_data_assessment: z.object({
    has_enough_for_classification: z.boolean(),
    has_enough_for_initial_estimate: z.boolean(),
    critical_missing_info: z.array(z.string().trim().max(500)).max(8),
  }),
  recommended_questions: z.array(classifyQuestionSchema).max(8),
  summary: z.string().trim().min(1).max(1000),
  confidence_level: z.enum(["low", "medium", "high"]),
});

export type ProjectAiClassifyOutput = z.infer<
  typeof projectAiClassifyOutputSchema
>;

export type ProjectAiClassifyRequirement = z.infer<
  typeof classifyRequirementSchema
>;

/**
 * JSON schema passed to the OpenAI structured-output API so the
 * model returns data that matches projectAiClassifyOutputSchema.
 */
export const projectAiClassifyResponseJsonSchema = {
  name: "project_ai_classify_output",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      project_classification: {
        type: "object",
        additionalProperties: false,
        properties: {
          project_type_key: { type: "string" },
          project_type_label: { type: "string" },
          description: { type: "string" },
          construction_sector: {
            type: "string",
            enum: [
              "residential",
              "commercial",
              "industrial",
              "infrastructure",
              "mixed",
            ],
          },
          complexity_level: {
            type: "string",
            enum: ["simple", "moderate", "complex"],
          },
        },
        required: [
          "project_type_key",
          "project_type_label",
          "description",
          "construction_sector",
          "complexity_level",
        ],
      },
      standard_requirements: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            item_key: { type: "string" },
            item_label: { type: "string" },
            category: {
              type: "string",
              enum: [...SCOPE_ITEM_CATEGORIES],
            },
            description: { type: "string" },
            why_standard: { type: "string" },
            is_mentioned_by_customer: { type: "boolean" },
            mention_summary: { type: ["string", "null"] },
            recommended_inclusion: {
              type: "string",
              enum: [...INCLUSION_LEVELS],
            },
            typical_cost_significance: {
              type: "string",
              enum: [...COST_SIGNIFICANCE_LEVELS],
            },
            customer_stated_quantity: { type: ["number", "null"] },
            customer_stated_unit: { type: ["string", "null"] },
            quantity_note: { type: ["string", "null"] },
          },
          required: [
            "item_key",
            "item_label",
            "category",
            "description",
            "why_standard",
            "is_mentioned_by_customer",
            "mention_summary",
            "recommended_inclusion",
            "typical_cost_significance",
            "customer_stated_quantity",
            "customer_stated_unit",
            "quantity_note",
          ],
        },
      },
      scope_gaps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            description: { type: "string" },
            severity: {
              type: "string",
              enum: [...GAP_SEVERITY_LEVELS],
            },
            suggestion: { type: "string" },
          },
          required: ["description", "severity", "suggestion"],
        },
      },
      customer_data_assessment: {
        type: "object",
        additionalProperties: false,
        properties: {
          has_enough_for_classification: { type: "boolean" },
          has_enough_for_initial_estimate: { type: "boolean" },
          critical_missing_info: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "has_enough_for_classification",
          "has_enough_for_initial_estimate",
          "critical_missing_info",
        ],
      },
      recommended_questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            question_key: { type: "string" },
            question_text: { type: "string" },
            question_type: {
              type: "string",
              enum: [
                "single_select",
                "multi_select",
                "number",
                "text",
                "upload_request",
              ],
            },
            help_text: { type: ["string", "null"] },
            placeholder: { type: ["string", "null"] },
            options: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                },
                required: ["id", "label"],
              },
            },
          },
          required: [
            "question_key",
            "question_text",
            "question_type",
            "help_text",
            "placeholder",
            "options",
          ],
        },
      },
      summary: { type: "string" },
      confidence_level: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
    },
    required: [
      "project_classification",
      "standard_requirements",
      "scope_gaps",
      "customer_data_assessment",
      "recommended_questions",
      "summary",
      "confidence_level",
    ],
  },
} as const;
