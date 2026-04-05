export interface ProjectPreviewMedia {
  file_type?: string | null;
  thumbnail_url?: string | null;
  annotated_url?: string | null;
  file_url?: string | null;
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
  if (!files || files.length === 0) {
    return null;
  }

  return (
    files.find((file) => isProjectImage(file)) ||
    files.find((file) => isProjectVideo(file)) ||
    files[0]
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
