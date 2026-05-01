"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";

function cleanOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeUrl(value: FormDataEntryValue | null) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) return null;

  try {
    const url = new URL(cleaned);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export async function updateEstimatorProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };
  if (!(await userHasRole(user.id, "estimator"))) {
    return { error: "Estimator mode is not enabled for this account." };
  }

  const displayName = cleanOptionalText(formData.get("displayName"));
  const headline = cleanOptionalText(formData.get("headline"));
  const bio = cleanOptionalText(formData.get("bio"));
  const serviceArea = cleanOptionalText(formData.get("serviceArea"));
  const websiteUrlRaw = cleanOptionalText(formData.get("websiteUrl"));
  const websiteUrl = normalizeUrl(formData.get("websiteUrl"));

  if (!displayName) {
    return { error: "Display name is required." };
  }

  if (websiteUrlRaw && !websiteUrl) {
    return { error: "Website URL must start with http:// or https://." };
  }

  const { error } = await supabase.from("estimator_profiles").upsert(
    {
      user_id: user.id,
      display_name: displayName,
      headline,
      bio,
      service_area: serviceArea,
      website_url: websiteUrl,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Estimator profile update error:", error);
    return { error: "Unable to update estimator profile." };
  }

  revalidatePath("/estimator");
  revalidatePath("/estimator/profile");
  revalidatePath("/estimate-packages");
  revalidatePath(`/profile/${user.id}`);

  return { success: true };
}

