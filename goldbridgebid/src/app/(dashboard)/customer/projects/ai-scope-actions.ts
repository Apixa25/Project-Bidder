"use server";

import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import type { ProjectAiAnalysisInput } from "@/lib/ai-estimates";
import { buildProjectAiScopeItems } from "@/lib/ai-scope-items";
import { analyzeProjectAiHybrid } from "@/lib/ai/project-ai-hybrid";
import { getProjectAiLlmSettings } from "@/lib/ai/openai-client";
import { enrichProjectAiFileSignals } from "@/lib/ai-upload-intelligence";
import { getCostEstimates } from "@/lib/projects/get-cost-estimates";

/**
 * Draft AI scope analysis for the "new project" page.
 * Lives in a dedicated server module so we do not load heavy project
 * dependencies (e.g. ffmpeg poster generation) on this code path — those
 * imports in `actions.ts` were causing 500s on Vercel for this server action.
 */
export async function analyzeProjectDraft(input: ProjectAiAnalysisInput) {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to use AI Scope Check.", analysis: null };
    }

    if (!(await userHasRole(user.id, "customer"))) {
      return {
        error: "Enable customer mode to use AI Scope Check.",
        analysis: null,
      };
    }

    const llmSettings = getProjectAiLlmSettings();
    console.log("[ai-scope-check] draft start", {
      requestId,
      userIdPrefix: user.id.slice(0, 8),
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
      projectAiLlmEnabledRaw: process.env.PROJECT_AI_LLM_ENABLED ?? null,
      llmEnabled: llmSettings.enabled,
      llmModel: llmSettings.model,
      llmTimeoutMs: llmSettings.timeoutMs,
      fileCount: input.files?.length ?? 0,
      titleLen: (input.title || "").length,
      descriptionLen: (input.description || "").length,
    });

    const enrichStarted = Date.now();
    const enrichedInput = {
      ...input,
      files: input.files
        ? await enrichProjectAiFileSignals(input.files, { requestId })
        : input.files,
    };
    console.log(`[ai-scope-check] enrich files done requestId=${requestId} ms=${Date.now() - enrichStarted}`);

    const benchStarted = Date.now();
    const benchmarks = await getCostEstimates();
    console.log(
      `[ai-scope-check] benchmarks requestId=${requestId} count=${benchmarks.length} ms=${Date.now() - benchStarted}`
    );

    const hybridStarted = Date.now();
    const analysis = await analyzeProjectAiHybrid(enrichedInput, benchmarks, {
      requestId,
    });
    console.log(
      `[ai-scope-check] hybrid done requestId=${requestId} ms=${Date.now() - hybridStarted} ` +
        `model=${analysis.model_name} fallback=${analysis.fallback_used}`
    );

    const scopeStarted = Date.now();
    const scopeItemDrafts = buildProjectAiScopeItems({
      input: enrichedInput,
      analysis,
      classification: analysis.classification || null,
    });
    console.log(
      `[ai-scope-check] scope drafts built requestId=${requestId} count=${scopeItemDrafts.length} ms=${Date.now() - scopeStarted}`
    );

    console.log(`[ai-scope-check] draft ok requestId=${requestId} totalMs=${Date.now() - enrichStarted}`);

    const payload = {
      error: null,
      analysis,
      classification: analysis.classification ?? null,
      scopeItemDrafts,
    };

    try {
      return JSON.parse(JSON.stringify(payload)) as typeof payload;
    } catch (serializationError) {
      console.error("[ai-scope-check] return payload JSON round-trip failed", {
        requestId,
        error:
          serializationError instanceof Error
            ? { name: serializationError.name, message: serializationError.message }
            : String(serializationError),
      });
      return {
        error:
          "AI Scope Check produced a result that could not be sent to your browser. Try shortening the description or try again.",
        analysis: null,
      };
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[ai-scope-check] Draft analysis failed:", {
      requestId,
      name: err.name,
      message: err.message,
      stackPreview: err.stack?.split("\n").slice(0, 12).join("\n"),
      cause:
        err.cause !== undefined
          ? err.cause instanceof Error
            ? { name: err.cause.name, message: err.cause.message }
            : String(err.cause)
          : undefined,
    });
    return {
      error:
        "AI Scope Check could not finish. Please try again, or save the project and refresh the AI estimate from the project page.",
      analysis: null,
    };
  }
}
