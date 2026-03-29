"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateAndUploadThumbnail } from "@/lib/generate-thumbnail";
import { getProfileRevalidatePaths } from "@/lib/auth/roles";

export async function addPortfolioItem(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const itemType = (formData.get("itemType") as string) || "showcase";
  const photos = formData.getAll("photos") as File[];
  const videos = formData.getAll("videos") as File[];
  const videoUrls = formData.getAll("videoUrls") as string[];

  if (!title) return { error: "Title is required." };

  const validPhotos = photos.filter((f) => f.size > 0);
  const validVideos = videos.filter((f) => f.size > 0);
  const validVideoUrls = videoUrls.filter((u) => u.trim().length > 0);

  if (itemType === "before_after") {
    if (validPhotos.length !== 2) {
      return { error: "Before & After requires exactly 2 photos (before and after)." };
    }
  } else {
    if (validPhotos.length === 0 && validVideos.length === 0 && validVideoUrls.length === 0) {
      return { error: "Please upload at least one photo or video." };
    }

    if (validPhotos.length > 15) {
      return { error: "Maximum 15 photos per portfolio item." };
    }

    if (validVideos.length + validVideoUrls.length > 3) {
      return { error: "Maximum 3 videos per portfolio item." };
    }
  }

  // Use the first photo as the cover, or fall back to first video
  let coverUrl = "";
  let coverType: "image" | "video" = "image";
  let coverThumbnail: string | null = null;

  // Create the portfolio item first
  const { count } = await supabase
    .from("portfolio_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: item, error: insertError } = await supabase
    .from("portfolio_items")
    .insert({
      user_id: user.id,
      media_url: "pending",
      media_type: "image",
      title,
      description: description || null,
      item_type: itemType === "before_after" ? "before_after" : "showcase",
      display_order: (count || 0) + 1,
    })
    .select("id")
    .single();

  if (insertError || !item) {
    console.error("Portfolio insert error:", insertError);
    return { error: "Failed to create portfolio item." };
  }

  const mediaRecords: {
    portfolio_item_id: string;
    media_url: string;
    media_type: string;
    thumbnail_url: string | null;
    display_order: number;
  }[] = [];

  let order = 0;

  // Upload photos
  for (const photo of validPhotos) {
    if (photo.size > 12 * 1024 * 1024) continue;

    const fileExt = photo.name.split(".").pop();
    const filePath = `portfolio/${user.id}/${item.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-media")
      .upload(filePath, photo);

    if (uploadError) {
      console.error("Photo upload error:", uploadError);
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("profile-media").getPublicUrl(filePath);

    let thumbUrl: string | null = null;
    thumbUrl = await generateAndUploadThumbnail(photo, "profile-media", filePath);

    mediaRecords.push({
      portfolio_item_id: item.id,
      media_url: publicUrl,
      media_type: "image",
      thumbnail_url: thumbUrl,
      display_order: order++,
    });

    if (!coverUrl) {
      coverUrl = publicUrl;
      coverType = "image";
      coverThumbnail = thumbUrl;
    }
  }

  // Upload video files
  for (const video of validVideos) {
    if (video.size > 300 * 1024 * 1024) continue;

    const fileExt = video.name.split(".").pop();
    const filePath = `portfolio/${user.id}/${item.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-media")
      .upload(filePath, video);

    if (uploadError) {
      console.error("Video upload error:", uploadError);
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("profile-media").getPublicUrl(filePath);

    mediaRecords.push({
      portfolio_item_id: item.id,
      media_url: publicUrl,
      media_type: "video",
      thumbnail_url: null,
      display_order: order++,
    });

    if (!coverUrl) {
      coverUrl = publicUrl;
      coverType = "video";
    }
  }

  // Add YouTube / video URLs
  for (const url of validVideoUrls) {
    mediaRecords.push({
      portfolio_item_id: item.id,
      media_url: url.trim(),
      media_type: "video",
      thumbnail_url: null,
      display_order: order++,
    });

    if (!coverUrl) {
      coverUrl = url.trim();
      coverType = "video";
    }
  }

  // Insert all media records
  if (mediaRecords.length > 0) {
    const { error: mediaError } = await supabase
      .from("portfolio_item_media")
      .insert(mediaRecords);

    if (mediaError) {
      console.error("Portfolio media insert error:", mediaError);
    }
  }

  // Update the cover image on the portfolio item
  await supabase
    .from("portfolio_items")
    .update({
      media_url: coverUrl || "pending",
      media_type: coverType,
      thumbnail_url: coverThumbnail,
    })
    .eq("id", item.id);

  const revalidatePaths = await getProfileRevalidatePaths(user.id);
  revalidatePaths.forEach((path) => revalidatePath(path));

  return { success: true };
}

export async function removePortfolioItem(itemId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // CASCADE will handle portfolio_item_media
  const { error } = await supabase
    .from("portfolio_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Portfolio delete error:", error);
    return { error: "Failed to remove item." };
  }

  const revalidatePaths = await getProfileRevalidatePaths(user.id);
  revalidatePaths.forEach((path) => revalidatePath(path));

  return { success: true };
}

export async function removePortfolioMedia(mediaId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("portfolio_item_media")
    .delete()
    .eq("id", mediaId);

  if (error) {
    console.error("Portfolio media delete error:", error);
    return { error: "Failed to remove media." };
  }

  const revalidatePaths = await getProfileRevalidatePaths(user.id);
  revalidatePaths.forEach((path) => revalidatePath(path));

  return { success: true };
}
