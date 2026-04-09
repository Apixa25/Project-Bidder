import "server-only";

import type {
  ProjectAiAnalysisInput,
  ProjectAiAnalysisResult,
} from "@/lib/ai-estimates";

import { getOpenAiClient, getProjectAiLlmSettings } from "./openai-client";
import { buildProjectAiLlmPrompt } from "./project-ai-llm-prompt";
import {
  projectAiLlmOutputSchema,
  projectAiLlmResponseJsonSchema,
  type ProjectAiLlmOutput,
} from "./project-ai-llm-schema";

export interface ProjectAiLlmAnalysis {
  analysis: ProjectAiLlmOutput;
  modelName: string;
  promptVersion: string;
}

function extractResponseText(response: {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const outputText = response.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text" && typeof item.text === "string")
    ?.text;

  return outputText?.trim() || "";
}

export async function analyzeProjectWithLlm(params: {
  input: ProjectAiAnalysisInput;
  rulesAnalysis: ProjectAiAnalysisResult;
}): Promise<ProjectAiLlmAnalysis> {
  const { input, rulesAnalysis } = params;
  const settings = getProjectAiLlmSettings();

  if (!settings.enabled) {
    throw new Error("Project AI LLM is disabled.");
  }

  const client = getOpenAiClient();
  const prompt = buildProjectAiLlmPrompt({
    input,
    rulesAnalysis,
    promptVersion: settings.promptVersion,
    maxInputChars: settings.maxInputChars,
  });

  const response = await client.responses.create(
    {
      model: settings.model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: prompt.system }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt.user }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          ...projectAiLlmResponseJsonSchema,
        },
      },
    },
    {
      signal: AbortSignal.timeout(settings.timeoutMs),
    }
  );

  const rawText = extractResponseText(response);
  if (!rawText) {
    throw new Error("OpenAI returned an empty response for project AI analysis.");
  }

  const parsed = projectAiLlmOutputSchema.parse(JSON.parse(rawText));

  return {
    analysis: parsed,
    modelName: `openai:${settings.model}`,
    promptVersion: settings.promptVersion,
  };
}
