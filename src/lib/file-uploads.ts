export const caseFileBucket = "case-files";
export const maxCaseFileBytes = 10 * 1024 * 1024;
export const maxClientFiles = 5;
export const maxStaffFiles = 10;

export const acceptedCaseFileTypes = [
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
] as const;

export const caseFileAccept = [
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt",
].join(",");

export function validateCaseFile(file: File) {
  if (!acceptedCaseFileTypes.includes(file.type as (typeof acceptedCaseFileTypes)[number])) {
    return `${file.name} is not a supported picture or document.`;
  }
  if (file.size < 1 || file.size > maxCaseFileBytes) {
    return `${file.name} must be smaller than 10 MB.`;
  }
  return null;
}

export function staffStoragePath(firmId: string, file: File) {
  const extension = file.name.match(/\.[a-z0-9]{1,8}$/i)?.[0]?.toLowerCase() || "";
  return `${firmId}/staff/${crypto.randomUUID()}${extension}`;
}
