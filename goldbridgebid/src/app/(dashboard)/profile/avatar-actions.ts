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

  const fileExt = file.name.split(".").pop() || "jpg";
  const filePath = `avatars/${user.id}/profile-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("profile-media")
    .upload(filePath, file, {
      contentType: file.type || undefined,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Avatar upload error:", uploadError);
    return { error: "Upload failed. Please try again." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("profile-media").getPublicUrl(filePath);

  try {
    await generateAndUploadThumbnail(file, "profile-media", filePath, {
      width: 150,
      quality: 75,
    });
  } catch (thumbnailError) {
    console.error("Avatar thumbnail generation failed:", thumbnailError);
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Profile update error:", updateError);
    return {
      error:
        process.env.NODE_ENV === "production"
          ? "Failed to save avatar."
          : `Failed to save avatar: ${updateError.message}`,
    };
  }

  const revalidatePaths = await getProfileRevalidatePaths(user.id);
  revalidatePaths.forEach((path) => revalidatePath(path));
  revalidatePath("/customer");
  revalidatePath("/bidder");

  return { success: true, url: publicUrl };
}

export async function removeAvatar() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("user_id", user.id);

  if (error) {
    console.error("Avatar remove profile update error:", error);
    return {
      error:
        process.env.NODE_ENV === "production"
          ? "Failed to remove avatar."
          : `Failed to remove avatar: ${error.message}`,
    };
  }

  const revalidatePaths = await getProfileRevalidatePaths(user.id);
  revalidatePaths.forEach((path) => revalidatePath(path));
  revalidatePath("/customer");
  revalidatePath("/bidder");

  return { success: true };
}

export async function uploadCompanyLogo(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const file = formData.get("companyLogo") as File;
  if (!file || file.size === 0) return { error: "No file selected." };

  if (!file.type.startsWith("image/")) {
    return { error: "Please upload an image file." };
  }

  if (file.size > 12 * 1024 * 1024) {
    return { error: "Image must be under 12MB." };
  }

  const fileExt = file.name.split(".").pop() || "jpg";
  const filePath = `company-logos/${user.id}/logo-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("profile-media")
    .upload(filePath, file, {
      contentType: file.type || undefined,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Company logo upload error:", uploadError);
    return { error: "Upload failed. Please try again." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("profile-media").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ company_logo_url: publicUrl })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Company logo profile update error:", updateError);
    return {
      error:
        process.env.NODE_ENV === "production"
          ? "Failed to save company logo."
          : `Failed to save company logo: ${updateError.message}`,
    };
  }

  const revalidatePaths = await getProfileRevalidatePaths(user.id);
  revalidatePaths.forEach((path) => revalidatePath(path));
  revalidatePath("/customer");
  revalidatePath("/bidder");

  return { success: true, url: publicUrl };
}

export async function removeCompanyLogo() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ company_logo_url: null })
    .eq("user_id", user.id);

  if (error) {
    console.error("Company logo remove profile update error:", error);
    return {
      error:
        process.env.NODE_ENV === "production"
          ? "Failed to remove company logo."
          : `Failed to remove company logo: ${error.message}`,
    };
  }

  const revalidatePaths = await getProfileRevalidatePaths(user.id);
  revalidatePaths.forEach((path) => revalidatePath(path));
  revalidatePath("/customer");
  revalidatePath("/bidder");

  return { success: true };
}
