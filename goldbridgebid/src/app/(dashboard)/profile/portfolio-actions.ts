"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addPortfolioItem(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const file = formData.get("media") as File;
  const videoUrl = formData.get("videoUrl") as string;

  if (!title) return { error: "Title is required." };

  let mediaUrl = "";
  let mediaType: "image" | "video" = "image";

  if (videoUrl) {
    mediaUrl = videoUrl;
    mediaType = "video";
  } else if (file && file.size > 0) {
    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? 300 * 1024 * 1024 : 12 * 1024 * 1024;
    const maxLabel = isVideo ? "300MB" : "12MB";
    if (file.size > maxSize) {
      return { error: `File must be under ${maxLabel}.` };
    }

    const fileExt = file.name.split(".").pop();
    const filePath = `portfolio/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-media")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Portfolio upload error:", uploadError);
      return { error: "Upload failed. Please try again." };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("profile-media").getPublicUrl(filePath);

    mediaUrl = publicUrl;
    mediaType = file.type.startsWith("video/") ? "video" : "image";
  } else {
    return { error: "Please upload a file or provide a video URL." };
  }

  const { count } = await supabase
    .from("portfolio_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { error: insertError } = await supabase
    .from("portfolio_items")
    .insert({
      user_id: user.id,
      media_url: mediaUrl,
      media_type: mediaType,
      title,
      description: description || null,
      display_order: (count || 0) + 1,
    });

  if (insertError) {
    console.error("Portfolio insert error:", insertError);
    return { error: "Failed to add portfolio item." };
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

export async function removePortfolioItem(itemId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("portfolio_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Portfolio delete error:", error);
    return { error: "Failed to remove item." };
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
