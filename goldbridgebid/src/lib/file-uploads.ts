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

export const IMAGE_FILE_ACCEPT = "image/*";
export const VIDEO_FILE_ACCEPT = "video/*";
export const PROJECT_DOCUMENT_ACCEPT_EXTENSIONS = PROJECT_DOCUMENT_EXTENSIONS;
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

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop();
  return extension ? `.${extension.toLowerCase()}` : "";
}

export function isImageFileType(fileType: string | null | undefined) {
  return !!fileType && fileType.startsWith("image/");
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

  return PROJECT_DOCUMENT_EXTENSIONS.includes(extension);
}

export function isAllowedBidAttachmentFile(file: Pick<File, "name" | "type">) {
  return isAllowedProjectFile(file);
}
