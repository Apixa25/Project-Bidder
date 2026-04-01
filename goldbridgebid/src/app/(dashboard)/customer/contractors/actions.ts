"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";

const ALLOWED_QUERY_PARAMS = new Set([
  "q",
  "badge",
  "trade",
  "state",
  "city",
  "sort",
]);

function sanitizeQueryString(raw: string) {
  const query = raw.startsWith("?") ? raw.slice(1) : raw;
  const incoming = new URLSearchParams(query);
  const sanitized = new URLSearchParams();

  for (const [key, value] of incoming.entries()) {
    if (!ALLOWED_QUERY_PARAMS.has(key) || !value.trim()) {
      continue;
    }

    sanitized.set(key, value.trim());
  }

  return sanitized.toString();
}

export async function saveContractorSearch(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to save contractor searches." };
  }

  const label = ((formData.get("label") as string) || "").trim();
  const queryString = sanitizeQueryString(
    ((formData.get("queryString") as string) || "").trim()
  );

  if (!label) {
    return { error: "Please give this search a short name." };
  }

  const { error } = await supabase
    .from("customer_saved_contractor_searches")
    .insert({
      user_id: user.id,
      label: label.slice(0, 80),
      query_string: queryString,
    });

  if (error) {
    console.error("Save contractor search error:", error);
    return { error: "Could not save this search right now." };
  }

  revalidatePath("/customer/contractors");
  return { success: true };
}

export async function deleteContractorSearch(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to manage saved contractor searches." };
  }

  const searchId = (formData.get("searchId") as string) || "";

  if (!searchId) {
    return { error: "Missing saved search id." };
  }

  const { error } = await supabase
    .from("customer_saved_contractor_searches")
    .delete()
    .eq("id", searchId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Delete contractor search error:", error);
    return { error: "Could not delete this saved search right now." };
  }

  revalidatePath("/customer/contractors");
  return { success: true };
}
