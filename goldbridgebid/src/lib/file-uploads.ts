const CREDENTIAL_DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];
const PROJECT_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
];
const PROJECT_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v"];
const PROJECT_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
];

export const IMAGE_FILE_ACCEPT = "image/*";
export const VIDEO_FILE_ACCEPT = "video/*";
export const PROJECT_DOCUMENT_ACCEPT_EXTENSIONS = PROJECT_DOCUMENT_EXTENSIONS;
export const PROJECT_VIDEO_FILE_ACCEPT = [
  ...PROJECT_VIDEO_EXTENSIONS,
  ...PROJECT_VIDEO_MIME_TYPES,
].join(",");
export const CREDENTIAL_FILE_ACCEPT = [
  IMAGE_FILE_ACCEPT,
  ...CREDENTIAL_DOCUMENT_EXTENSIONS,
].join(",");
export const PROJECT_DOCUMENT_FILE_ACCEPT = [
  ...PROJECT_DOCUMENT_EXTENSIONS,
].join(",");
export const BID_ATTACHMENT_FILE_ACCEPT = [
  IMAGE_FILE_ACCEPT,
  ...PROJECT_DOCUMENT_EXTENSIONS,
].join(",");
export const ESTIMATE_PACKAGE_FILE_ACCEPT = [
  IMAGE_FILE_ACCEPT,
  ...PROJECT_DOCUMENT_EXTENSIONS,
].join(",");

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop();
  return extension ? `.${extension.toLowerCase()}` : "";
}

export function isImageFileType(fileType: string | null | undefined) {
  return !!fileType && fileType.startsWith("image/");
}

export function isVideoFileType(fileType: string | null | undefined) {
  return !!fileType && fileType.startsWith("video/");
}

export function isAllowedCredentialFile(file: Pick<File, "name" | "type">) {
  const extension = getFileExtension(file.name);

  if (isImageFileType(file.type)) {
    return true;
  }

  return CREDENTIAL_DOCUMENT_EXTENSIONS.includes(extension);
}

export function isAllowedProjectFile(file: Pick<File, "name" | "type">) {
  const extension = getFileExtension(file.name);

  if (isImageFileType(file.type)) {
    return true;
  }

  if (isVideoFileType(file.type) || PROJECT_VIDEO_EXTENSIONS.includes(extension)) {
    return (
      PROJECT_VIDEO_EXTENSIONS.includes(extension) ||
      PROJECT_VIDEO_MIME_TYPES.includes(file.type)
    );
  }

  return PROJECT_DOCUMENT_EXTENSIONS.includes(extension);
}

export function isAllowedBidAttachmentFile(file: Pick<File, "name" | "type">) {
  const extension = getFileExtension(file.name);

  if (isImageFileType(file.type)) {
    return true;
  }

  return PROJECT_DOCUMENT_EXTENSIONS.includes(extension);
}

export function isAllowedEstimatePackageFile(file: Pick<File, "name" | "type">) {
  const extension = getFileExtension(file.name);

  if (isImageFileType(file.type)) {
    return true;
  }

  return PROJECT_DOCUMENT_EXTENSIONS.includes(extension);
}
