export type UploadLike = { name: string; type?: string | null };

const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function parseTemplateFields(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((field) => normalizeField(field))
        .filter(Boolean),
    ),
  );
}

export function normalizeField(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function isDocxFile(file: UploadLike) {
  const hasDocxExtension = file.name.toLowerCase().endsWith(".docx");
  if (!hasDocxExtension) return false;
  if (!file.type) return true;
  return file.type === docxMime || file.type === "application/octet-stream";
}

export function makeTemplateStoragePath(firmId: string, fileName: string, key: string) {
  return `${firmId}/${key}-${sanitizeFileName(fileName)}`;
}

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").toLowerCase();
}

export function humanizeField(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
