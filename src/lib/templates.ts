export type UploadLike = { name: string; type?: string | null };
const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const pdfMime = "application/pdf";
export const standardNameFields = ["client_name","notary_name","attorney_name","witness_name"] as const;
export const standardIntakeFields = ["client_name","client_dob","client_email","client_phone","client_address","practice_area","incident_date","incident_location","responsible_party","document_date","notary_name","attorney_name","witness_name"] as const;
export function parseTemplateFields(value:string){return Array.from(new Set(value.split(/[\n,]/).map(normalizeField).filter(Boolean)))}
export function withStandardNameFields(fields:string[]){return Array.from(new Set([...standardNameFields,...fields]))}
export function normalizeField(value:string){return value.trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")}
export function isTemplateFile(file:UploadLike){const n=file.name.toLowerCase(); if(n.endsWith(".docx")) return !file.type||file.type===docxMime||file.type==="application/octet-stream"; if(n.endsWith(".pdf")) return !file.type||file.type===pdfMime||file.type==="application/octet-stream"; return false}
export function isDocxFile(file:UploadLike){return file.name.toLowerCase().endsWith(".docx")&&(!file.type||file.type===docxMime||file.type==="application/octet-stream")}
export function makeTemplateStoragePath(firmId:string,fileName:string,key:string){return `${firmId}/${key}-${sanitizeFileName(fileName)}`}
export function sanitizeFileName(fileName:string){return fileName.replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/-+/g,"-").toLowerCase()}
export function humanizeField(value:string){return value.split("_").filter(Boolean).map(part=>part[0].toUpperCase()+part.slice(1)).join(" ")}
