import "server-only";

import type { ProjectAiAnalysisInput } from "@/lib/ai-estimates";
import { getOpenAiClient, getProjectAiLlmSettings } from "./openai-client";
import { buildProjectAiClassifyPrompt } from "./project-ai-classify-prompt";
import {
  projectAiClassifyOutputSchema,
  projectAiClassifyResponseJsonSchema,
  type ProjectAiClassifyOutput,
} from "./project-ai-classify-schema";

export interface ProjectAiClassifyResult {
  classification: ProjectAiClassifyOutput;
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
  if (
    typeof response.output_text === "string" &&
    response.output_text.trim()
  ) {
    return response.output_text;
  }

  const outputText = response.output
    ?.flatMap((item) => item.content || [])
    .find(
      (item) => item.type === "output_text" && typeof item.text === "string"
    )?.text;

  return outputText?.trim() || "";
}

export async function classifyProjectWithLlm(
  input: ProjectAiAnalysisInput
): Promise<ProjectAiClassifyResult> {
  const settings = getProjectAiLlmSettings();

  if (!settings.enabled) {
    throw new Error("Project AI LLM is disabled.");
  }

  const client = getOpenAiClient();
  const prompt = buildProjectAiClassifyPrompt({
    input,
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
          ...projectAiClassifyResponseJsonSchema,
        },
      },
    },
    {
      signal: AbortSignal.timeout(settings.timeoutMs),
    }
  );

  const rawText = extractResponseText(response);
  if (!rawText) {
    throw new Error(
      "OpenAI returned an empty response for project classification."
    );
  }

  const parsed = projectAiClassifyOutputSchema.parse(JSON.parse(rawText));

  return {
    classification: parsed,
    modelName: `openai:${settings.model}`,
    promptVersion: settings.promptVersion,
  };
}
