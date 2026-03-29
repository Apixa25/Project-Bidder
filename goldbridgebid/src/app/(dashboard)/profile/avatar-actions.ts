"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateAndUploadThumbnail } from "@/lib/generate-thumbnail";
import { getProfileRevalidatePaths } from "@/lib/auth/roles";

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const file = formData.get("avatar") as File;
  if (!file || file.size === 0) return { error: "No file selected." };

  if (!file.type.startsWith("image/")) {
    return { error: "Please upload an image file." };
  }

  if (file.size > 12 * 1024 * 1024) {
    return { error: "Image must be under 12MB." };
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `avatars/${user.id}/profile.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("profile-media")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error("Avatar upload error:", uploadError);
    return { error: "Upload failed. Please try again." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("profile-media").getPublicUrl(filePath);

  await generateAndUploadThumbnail(file, "profile-media", filePath, {
    width: 150,
    quality: 75,
  });

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Profile update error:", updateError);
    return { error: "Failed to save avatar." };
  }

  const revalidatePaths = await getProfileRevalidatePaths(user.id);
  revalidatePaths.forEach((path) => revalidatePath(path));

  return { success: true, url: publicUrl };
}

export async function removeAvatar() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("user_id", user.id);

  const revalidatePaths = await getProfileRevalidatePaths(user.id);
  revalidatePaths.forEach((path) => revalidatePath(path));

  return { success: true };
}
