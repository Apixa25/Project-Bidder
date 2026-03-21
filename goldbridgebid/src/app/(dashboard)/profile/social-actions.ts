"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateSocialLinks(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const website = formData.get("website") as string;
  const facebook = formData.get("facebook") as string;
  const linkedin = formData.get("linkedin") as string;
  const instagram = formData.get("instagram") as string;
  const otherLabel = formData.get("otherLabel") as string;
  const otherUrl = formData.get("otherUrl") as string;

  const { error } = await supabase
    .from("profiles")
    .update({
      website_url: website || null,
      facebook_url: facebook || null,
      linkedin_url: linkedin || null,
      instagram_url: instagram || null,
      other_link_url: otherUrl || null,
      other_link_label: otherLabel || null,
    })
    .eq("user_id", user.id);

  if (error) {
    console.error("Social links update error:", error);
    return { error: "Failed to save links." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const basePath = profile?.role === "bidder" ? "/bidder" : "/customer";
  revalidatePath(`${basePath}/profile`);

  return { success: true };
}
