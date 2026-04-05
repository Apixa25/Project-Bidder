import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

async function runFfmpeg(args: string[]) {
  return await new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg binary not available"));
      return;
    }

    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

export async function generateAndUploadVideoPoster(
  file: File,
  bucket: string,
  originalPath: string
): Promise<string | null> {
  if (!file.type.startsWith("video/")) {
    return null;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "project-video-"));
  const inputExt = path.extname(file.name) || ".mp4";
  const inputPath = path.join(tempDir, `${randomUUID()}${inputExt}`);
  const rawPosterPath = path.join(tempDir, `${randomUUID()}-frame.jpg`);

  try {
    await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()));

    await runFfmpeg([
      "-y",
      "-ss",
      "00:00:00.500",
      "-i",
      inputPath,
      "-frames:v",
      "1",
      rawPosterPath,
    ]);

    const posterBuffer = await sharp(rawPosterPath)
      .resize(640, 360, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();

    const posterPath = originalPath.replace(
      /^(.+\/)([^/]+)$/,
      "$1thumbs/$2"
    ).replace(/\.[^.]+$/, ".jpg");

    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(posterPath, posterBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Video poster upload error:", uploadError);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(posterPath);

    return publicUrl;
  } catch (error) {
    console.error("Video poster generation error:", error);
    return null;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
