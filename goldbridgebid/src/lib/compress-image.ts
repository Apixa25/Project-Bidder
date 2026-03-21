import imageCompression from "browser-image-compression";

export interface CompressionPreset {
  maxSizeMB: number;
  maxWidthOrHeight: number;
}

export const PRESETS = {
  general: { maxSizeMB: 0.8, maxWidthOrHeight: 2048 } as CompressionPreset,
  avatar: { maxSizeMB: 0.2, maxWidthOrHeight: 512 } as CompressionPreset,
} as const;

function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * Compress a single image file. Non-image files are returned as-is.
 * Returns the compressed File and the original size for UI feedback.
 */
export async function compressImage(
  file: File,
  preset: CompressionPreset = PRESETS.general,
  onProgress?: (progress: number) => void
): Promise<{ file: File; originalSize: number; compressed: boolean }> {
  if (!isImage(file)) {
    return { file, originalSize: file.size, compressed: false };
  }

  // Skip if already under target size
  if (file.size <= preset.maxSizeMB * 1024 * 1024) {
    return { file, originalSize: file.size, compressed: false };
  }

  const originalSize = file.size;

  const compressed = await imageCompression(file, {
    maxSizeMB: preset.maxSizeMB,
    maxWidthOrHeight: preset.maxWidthOrHeight,
    useWebWorker: true,
    preserveExif: false,
    onProgress,
  });

  const compressedFile = new File([compressed], file.name, {
    type: compressed.type,
    lastModified: Date.now(),
  });

  return { file: compressedFile, originalSize, compressed: true };
}

/**
 * Compress an array of files. Images get compressed, non-images pass through.
 * Returns the compressed files and a summary of savings.
 */
export async function compressFiles(
  files: File[],
  preset: CompressionPreset = PRESETS.general,
  onFileProgress?: (index: number, progress: number) => void
): Promise<{
  files: File[];
  totalOriginalSize: number;
  totalCompressedSize: number;
  imageCount: number;
}> {
  let totalOriginalSize = 0;
  let totalCompressedSize = 0;
  let imageCount = 0;

  const results = await Promise.all(
    files.map(async (file, index) => {
      const result = await compressImage(file, preset, (progress) =>
        onFileProgress?.(index, progress)
      );
      totalOriginalSize += result.originalSize;
      totalCompressedSize += result.file.size;
      if (result.compressed) imageCount++;
      return result.file;
    })
  );

  return {
    files: results,
    totalOriginalSize,
    totalCompressedSize,
    imageCount,
  };
}
