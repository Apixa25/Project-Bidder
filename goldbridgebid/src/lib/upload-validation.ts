import {
  isImageFileType,
  isVideoFileType,
  isAllowedBidAttachmentFile,
  isAllowedEstimatePackageFile,
  isAllowedProjectFile,
} from "@/lib/file-uploads";

const MB = 1024 * 1024;

export const MAX_PROJECT_IMAGE_BYTES = 12 * MB;
export const MAX_PROJECT_DOCUMENT_BYTES = 50 * MB;
export const MAX_PROJECT_VIDEO_BYTES = 75 * MB;
export const MAX_PROJECT_VIDEO_COUNT = 2;
export const MAX_BID_ATTACHMENT_IMAGE_BYTES = 12 * MB;
export const MAX_BID_ATTACHMENT_DOCUMENT_BYTES = 50 * MB;
export const MAX_ESTIMATE_PACKAGE_IMAGE_BYTES = 12 * MB;
export const MAX_ESTIMATE_PACKAGE_DOCUMENT_BYTES = 50 * MB;

function getLimitLabel(bytes: number) {
  return `${Math.round(bytes / MB)}MB`;
}

function validateFile(
  file: Pick<File, "name" | "type" | "size">,
  options: {
    allowFile: (file: Pick<File, "name" | "type">) => boolean;
    imageMaxBytes: number;
    videoMaxBytes?: number;
    documentMaxBytes: number;
    imageLabel: string;
    videoLabel?: string;
    documentLabel: string;
  }
) {
  if (!options.allowFile(file)) {
    return `Unsupported file type for "${file.name}".`;
  }

  const sizeLimit = isImageFileType(file.type)
    ? options.imageMaxBytes
    : isVideoFileType(file.type)
      ? options.videoMaxBytes || options.documentMaxBytes
      : options.documentMaxBytes;

  if (file.size > sizeLimit) {
    const label = isImageFileType(file.type)
      ? options.imageLabel
      : isVideoFileType(file.type)
        ? options.videoLabel || options.documentLabel
      : options.documentLabel;
    return `"${file.name}" exceeds the ${label} upload limit of ${getLimitLabel(
      sizeLimit
    )}.`;
  }

  return null;
}

export function validateProjectUploadFile(file: Pick<File, "name" | "type" | "size">) {
  return validateFile(file, {
    allowFile: isAllowedProjectFile,
    imageMaxBytes: MAX_PROJECT_IMAGE_BYTES,
    videoMaxBytes: MAX_PROJECT_VIDEO_BYTES,
    documentMaxBytes: MAX_PROJECT_DOCUMENT_BYTES,
    imageLabel: "project image",
    videoLabel: "project video",
    documentLabel: "project document",
  });
}

export function validateProjectUploadFiles(
  files: Array<Pick<File, "name" | "type" | "size">>,
  existingVideoCount = 0
) {
  let totalVideoCount = existingVideoCount;

  for (const file of files) {
    const validationError = validateProjectUploadFile(file);
    if (validationError) {
      return validationError;
    }

    if (isVideoFileType(file.type)) {
      totalVideoCount += 1;
    }
  }

  if (totalVideoCount > MAX_PROJECT_VIDEO_COUNT) {
    return `Projects can include up to ${MAX_PROJECT_VIDEO_COUNT} videos total.`;
  }

  return null;
}

export function validateBidAttachmentFile(file: Pick<File, "name" | "type" | "size">) {
  return validateFile(file, {
    allowFile: isAllowedBidAttachmentFile,
    imageMaxBytes: MAX_BID_ATTACHMENT_IMAGE_BYTES,
    documentMaxBytes: MAX_BID_ATTACHMENT_DOCUMENT_BYTES,
    imageLabel: "bid image",
    documentLabel: "bid attachment",
  });
}

export function validateEstimatePackageFile(
  file: Pick<File, "name" | "type" | "size">
) {
  return validateFile(file, {
    allowFile: isAllowedEstimatePackageFile,
    imageMaxBytes: MAX_ESTIMATE_PACKAGE_IMAGE_BYTES,
    documentMaxBytes: MAX_ESTIMATE_PACKAGE_DOCUMENT_BYTES,
    imageLabel: "estimate package image",
    documentLabel: "estimate package file",
  });
}

export function validateEstimatePackageFiles(
  files: Array<Pick<File, "name" | "type" | "size">>
) {
  for (const file of files) {
    const validationError = validateEstimatePackageFile(file);
    if (validationError) {
      return validationError;
    }
  }

  return null;
}
