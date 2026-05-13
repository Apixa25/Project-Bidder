import { createAdminClient } from "@/lib/supabase/admin";

export async function startCronRun(jobName: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cron_job_runs")
    .insert({
      job_name: jobName,
      status: "running",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error(`[cron-tracking] Failed to start run for ${jobName}:`, error);
    return "";
  }

  return data.id;
}

export async function completeCronRun(
  runId: string,
  status: "success" | "failed",
  itemsProcessed: number = 0,
  errorMessage?: string,
  details: Record<string, unknown> = {}
) {
  if (!runId) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("cron_job_runs")
    .update({
      completed_at: new Date().toISOString(),
      status,
      items_processed: itemsProcessed,
      error_message: errorMessage || null,
      details,
    })
    .eq("id", runId);

  if (error) {
    console.error(`[cron-tracking] Failed to complete run ${runId}:`, error);
  }
}

export async function withCronTracking<T>(
  jobName: string,
  fn: () => Promise<{ itemsProcessed: number; details?: Record<string, unknown>; result: T }>
): Promise<T> {
  const runId = await startCronRun(jobName);
  try {
    const { itemsProcessed, details, result } = await fn();
    await completeCronRun(runId, "success", itemsProcessed, undefined, details);
    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await completeCronRun(runId, "failed", 0, errorMessage);
    throw err;
  }
}
