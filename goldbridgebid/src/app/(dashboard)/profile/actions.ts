"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getProfileRevalidatePaths } from "@/lib/auth/roles";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const fullName = formData.get("fullName") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const zip = formData.get("zip") as string;
  const bio = formData.get("bio") as string;
  const businessName = formData.get("businessName") as string;

  if (!fullName || !phone || !address) {
    return { error: "Name, phone, and address are required." };
  }

  const updateData: Record<string, string | null> = {
    full_name: fullName,
    phone,
    address,
    city: city || "",
    state: state || "",
    zip: zip || "",
    bio: bio || null,
  };

  if (businessName !== undefined && businessName !== null) {
    updateData.business_name = businessName || null;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("user_id", user.id);

  if (error) {
    console.error("Profile update error:", error);
    return { error: "Failed to update profile." };
  }

  const revalidatePaths = await getProfileRevalidatePaths(user.id);
  revalidatePaths.forEach((path) => revalidatePath(path));

  return { success: true };
}
