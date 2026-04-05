import {
  isImageFileType,
  isAllowedBidAttachmentFile,
  isAllowedProjectFile,
} from "@/lib/file-uploads";

const MB = 1024 * 1024;

export const MAX_PROJECT_IMAGE_BYTES = 12 * MB;
export const MAX_PROJECT_DOCUMENT_BYTES = 50 * MB;
export const MAX_BID_ATTACHMENT_IMAGE_BYTES = 12 * MB;
export const MAX_BID_ATTACHMENT_DOCUMENT_BYTES = 50 * MB;

function getLimitLabel(bytes: number) {
  return `${Math.round(bytes / MB)}MB`;
}

function validateFile(
  file: File,
  options: {
    allowFile: (file: File) => boolean;
    imageMaxBytes: number;
    documentMaxBytes: number;
    imageLabel: string;
    documentLabel: string;
  }
) {
  if (!options.allowFile(file)) {
    return `Unsupported file type for "${file.name}".`;
  }

  const sizeLimit = isImageFileType(file.type)
    ? options.imageMaxBytes
    : options.documentMaxBytes;

  if (file.size > sizeLimit) {
    const label = isImageFileType(file.type)
      ? options.imageLabel
      : options.documentLabel;
    return `"${file.name}" exceeds the ${label} upload limit of ${getLimitLabel(
      sizeLimit
    )}.`;
  }

  return null;
}

export function validateProjectUploadFile(file: File) {
  return validateFile(file, {
    allowFile: isAllowedProjectFile,
    imageMaxBytes: MAX_PROJECT_IMAGE_BYTES,
    documentMaxBytes: MAX_PROJECT_DOCUMENT_BYTES,
    imageLabel: "project image",
    documentLabel: "project document",
  });
}

export function validateBidAttachmentFile(file: File) {
  return validateFile(file, {
    allowFile: isAllowedBidAttachmentFile,
    imageMaxBytes: MAX_BID_ATTACHMENT_IMAGE_BYTES,
    documentMaxBytes: MAX_BID_ATTACHMENT_DOCUMENT_BYTES,
    imageLabel: "bid image",
    documentLabel: "bid attachment",
  });
}
