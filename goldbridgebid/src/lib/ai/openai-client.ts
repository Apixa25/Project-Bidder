import "server-only";

import OpenAI from "openai";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_INPUT_CHARS = 12_000;
const DEFAULT_MAX_QUESTIONS = 6;

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface ProjectAiLlmSettings {
  enabled: boolean;
  apiKey: string | null;
  model: string;
  timeoutMs: number;
  promptVersion: string;
  maxInputChars: number;
  maxQuestions: number;
}

export function getProjectAiLlmSettings(): ProjectAiLlmSettings {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || null;

  return {
    enabled: process.env.PROJECT_AI_LLM_ENABLED === "true" && Boolean(apiKey),
    apiKey,
    model: process.env.PROJECT_AI_OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    timeoutMs: parsePositiveInt(
      process.env.PROJECT_AI_LLM_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS
    ),
    promptVersion: process.env.PROJECT_AI_PROMPT_VERSION?.trim() || "v1",
    maxInputChars: parsePositiveInt(
      process.env.PROJECT_AI_MAX_INPUT_CHARS,
      DEFAULT_MAX_INPUT_CHARS
    ),
    maxQuestions: parsePositiveInt(
      process.env.PROJECT_AI_MAX_QUESTIONS,
      DEFAULT_MAX_QUESTIONS
    ),
  };
}

export function getOpenAiClient() {
  const settings = getProjectAiLlmSettings();

  if (!settings.apiKey) {
    throw new Error("Missing OPENAI_API_KEY for project AI analysis.");
  }

  return new OpenAI({ apiKey: settings.apiKey });
}
