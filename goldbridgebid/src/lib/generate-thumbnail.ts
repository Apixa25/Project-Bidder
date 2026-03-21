import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

interface ThumbnailOptions {
  width?: number;
  quality?: number;
}

const DEFAULTS: Required<ThumbnailOptions> = {
  width: 400,
  quality: 70,
};

/**
 * Generate a JPEG thumbnail from an image file, upload it to the same
 * Supabase Storage bucket under a `thumbs/` prefix, and return the public URL.
 */
export async function generateAndUploadThumbnail(
  file: File,
  bucket: string,
  originalPath: string,
  options: ThumbnailOptions = {}
): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;

  const { width, quality } = { ...DEFAULTS, ...options };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const thumbnailBuffer = await sharp(buffer)
      .resize(width, undefined, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    const thumbPath = originalPath.replace(
      /^(.+\/)([^/]+)$/,
      "$1thumbs/$2"
    ).replace(/\.[^.]+$/, ".jpg");

    const supabase = await createClient();

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(thumbPath, thumbnailBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Thumbnail upload error:", uploadError);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(thumbPath);

    return publicUrl;
  } catch (err) {
    console.error("Thumbnail generation error:", err);
    return null;
  }
}
