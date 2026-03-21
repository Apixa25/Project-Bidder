"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Profile update error:", updateError);
    return { error: "Failed to save avatar." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const basePath = profile?.role === "bidder" ? "/bidder" : "/customer";
  revalidatePath(`${basePath}/profile`);

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const basePath = profile?.role === "bidder" ? "/bidder" : "/customer";
  revalidatePath(`${basePath}/profile`);

  return { success: true };
}
