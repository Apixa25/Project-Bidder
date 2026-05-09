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
  requestId?: string;
}): Promise<ProjectAiLlmAnalysis> {
  const { input, rulesAnalysis, requestId } = params;
  const rid = requestId ? ` requestId=${requestId}` : "";

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

  const started = Date.now();
  console.log(`[ai-scope-check][analyze] OpenAI request start${rid}`, {
    model: settings.model,
    timeoutMs: settings.timeoutMs,
    systemChars: prompt.system.length,
    userChars: prompt.user.length,
  });

  let response: Awaited<ReturnType<typeof client.responses.create>>;
  try {
    response = await client.responses.create(
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
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const apiErr = error as { status?: number; code?: string; type?: string };
    console.error(`[ai-scope-check][analyze] OpenAI request failed${rid}`, {
      name: err.name,
      message: err.message,
      apiStatus: apiErr.status,
      apiCode: apiErr.code,
      apiType: apiErr.type,
      ms: Date.now() - started,
    });
    throw error;
  }

  console.log(`[ai-scope-check][analyze] OpenAI response received${rid}`, {
    ms: Date.now() - started,
    responseId:
      response && typeof response === "object" && "id" in response
        ? String((response as { id?: string }).id ?? "")
        : "",
  });

  const rawText = extractResponseText(response);
  if (!rawText) {
    console.error(`[ai-scope-check][analyze] empty model output${rid}`);
    throw new Error("OpenAI returned an empty response for project AI analysis.");
  }

  let parsed: ProjectAiLlmOutput;
  try {
    parsed = projectAiLlmOutputSchema.parse(JSON.parse(rawText));
  } catch (parseErr) {
    console.error(`[ai-scope-check][analyze] JSON/schema parse failed${rid}`, {
      rawChars: rawText.length,
      rawPreview: rawText.slice(0, 400),
      parseErr:
        parseErr instanceof Error
          ? { name: parseErr.name, message: parseErr.message }
          : String(parseErr),
    });
    throw parseErr;
  }

  console.log(`[ai-scope-check][analyze] done${rid}`, {
    ms: Date.now() - started,
    recommendedQuestions: parsed.recommended_questions?.length ?? 0,
  });

  return {
    analysis: parsed,
    modelName: `openai:${settings.model}`,
    promptVersion: settings.promptVersion,
  };
}
