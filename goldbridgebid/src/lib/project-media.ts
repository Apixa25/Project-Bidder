export interface ProjectPreviewMedia {
  thumbnail_url?: string | null;
  annotated_url?: string | null;
  file_url?: string | null;
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
