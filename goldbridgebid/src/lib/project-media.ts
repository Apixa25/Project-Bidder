export interface ProjectPreviewMedia {
  id?: string;
  file_type?: string | null;
  display_order?: number | null;
  thumbnail_url?: string | null;
  annotated_url?: string | null;
  file_url?: string | null;
  uploaded_at?: string | null;
}

export interface ProjectMediaSummary {
  imageCount: number;
  videoCount: number;
  documentCount: number;
  totalCount: number;
}

export function isProjectImage(
  file: ProjectPreviewMedia | null | undefined
) {
  return !!file?.file_type && file.file_type.startsWith("image/");
}

export function isProjectVideo(
  file: ProjectPreviewMedia | null | undefined
) {
  return !!file?.file_type && file.file_type.startsWith("video/");
}

export function getProjectPreviewUrl(
  file: ProjectPreviewMedia | null | undefined
) {
  if (!file) {
    return null;
  }

  // List and card views should prefer lightweight derivatives first.
  return file.thumbnail_url || file.annotated_url || file.file_url || null;
}

export function getProjectPreviewFile(
  files: ProjectPreviewMedia[] | null | undefined
) {
  const orderedFiles = getProjectOrderedFiles(files);

  return (
    orderedFiles.find((file) => isProjectImage(file) || isProjectVideo(file)) ||
    orderedFiles[0] ||
    null
  );
}

export function getProjectMediaSummary(
  files: ProjectPreviewMedia[] | null | undefined
): ProjectMediaSummary {
  const summary = {
    imageCount: 0,
    videoCount: 0,
    documentCount: 0,
    totalCount: 0,
  };

  for (const file of files || []) {
    summary.totalCount += 1;

    if (isProjectImage(file)) {
      summary.imageCount += 1;
      continue;
    }

    if (isProjectVideo(file)) {
      summary.videoCount += 1;
      continue;
    }

    summary.documentCount += 1;
  }

  return summary;
}

export function getProjectOrderedFiles(
  files: ProjectPreviewMedia[] | null | undefined
) {
  return (files || [])
    .map((file, index) => ({ file, index }))
    .sort((left, right) => {
      const leftOrder =
        typeof left.file.display_order === "number"
          ? left.file.display_order
          : Number.MAX_SAFE_INTEGER;
      const rightOrder =
        typeof right.file.display_order === "number"
          ? right.file.display_order
          : Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      const leftUploadedAt = left.file.uploaded_at || "";
      const rightUploadedAt = right.file.uploaded_at || "";
      if (leftUploadedAt !== rightUploadedAt) {
        return leftUploadedAt.localeCompare(rightUploadedAt);
      }

      return left.index - right.index;
    })
    .map((entry) => entry.file);
}
