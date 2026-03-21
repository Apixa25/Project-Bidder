"use server";

import { createClient } from "@/lib/supabase/server";

export async function resolveFlag(flagId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Not authorized" };

  await supabase
    .from("flagged_content")
    .update({ resolved: true })
    .eq("id", flagId);

  return { success: true };
}
