import type { ProjectAiClarificationQuestionType } from "@/lib/ai-estimates";

import { z } from "zod";

const QUESTION_TYPES = [
  "single_select",
  "multi_select",
  "number",
  "text",
  "upload_request",
] as const satisfies readonly ProjectAiClarificationQuestionType[];

export const projectAiQuestionTypeSchema = z.enum(QUESTION_TYPES);

export const projectAiLlmQuestionOptionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
});

export const projectAiLlmQuestionSchema = z.object({
  question_key: z.string().trim().min(1).max(80),
  question_text: z.string().trim().min(1).max(240),
  question_type: projectAiQuestionTypeSchema,
  help_text: z.string().trim().max(280).nullable(),
  placeholder: z.string().trim().max(180).nullable(),
  options: z.array(projectAiLlmQuestionOptionSchema).max(8),
});

export const projectAiLlmLaborEstimateSchema = z.object({
  total_hours_low: z.number().int().min(1).max(10000),
  total_hours_high: z.number().int().min(1).max(10000),
  reasoning: z.string().trim().max(400),
});

export const projectAiLlmOutputSchema = z.object({
  suggested_status: z.enum([
    "insufficient_data",
    "needs_clarification",
    "ready",
  ]),
  confidence_level: z.enum(["low", "medium", "high"]),
  summary: z.string().trim().min(1).max(600),
  missing_items: z.array(z.string().trim().min(1).max(180)).max(12),
  assumptions: z.array(z.string().trim().min(1).max(220)).max(10),
  exclusions: z.array(z.string().trim().min(1).max(220)).max(10),
  recommended_questions: z.array(projectAiLlmQuestionSchema).max(8),
  confidence_reason: z.string().trim().max(300).nullable(),
  needs_human_review: z.boolean(),
  labor_hour_estimate: projectAiLlmLaborEstimateSchema.nullable(),
});

export type ProjectAiLlmOutput = z.infer<typeof projectAiLlmOutputSchema>;

export const projectAiLlmResponseJsonSchema = {
  name: "project_ai_llm_output",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      suggested_status: {
        type: "string",
        enum: ["insufficient_data", "needs_clarification", "ready"],
      },
      confidence_level: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
      summary: {
        type: "string",
      },
      missing_items: {
        type: "array",
        items: { type: "string" },
      },
      assumptions: {
        type: "array",
        items: { type: "string" },
      },
      exclusions: {
        type: "array",
        items: { type: "string" },
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
              enum: [...QUESTION_TYPES],
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
      confidence_reason: { type: ["string", "null"] },
      needs_human_review: { type: "boolean" },
      labor_hour_estimate: {
        type: ["object", "null"],
        properties: {
          total_hours_low: { type: "integer" },
          total_hours_high: { type: "integer" },
          reasoning: { type: "string" },
        },
        required: ["total_hours_low", "total_hours_high", "reasoning"],
        additionalProperties: false,
      },
    },
    required: [
      "suggested_status",
      "confidence_level",
      "summary",
      "missing_items",
      "assumptions",
      "exclusions",
      "recommended_questions",
      "confidence_reason",
      "needs_human_review",
      "labor_hour_estimate",
    ],
  },
} as const;
