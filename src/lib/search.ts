import { z } from "zod";
import { addDays, firmDateTimeToIso, validDateKey, weekStart, firmDateTime } from "./calendar";

export type SearchSource = {
  key: string; label: string; table: string; route: string;
  text: string[]; title: string[]; detail: string[]; extra?: string[];
  dates?: string[]; timestamps?: string[]; numbers?: string[]; adminOnly?: boolean;
};

export const searchSources: SearchSource[] = [
  { key: "clients", label: "Clients", table: "clients", route: "/clients", text: ["name","email","phone","address","preferred_contact","status"], title: ["name"], detail: ["email","phone","status"] },
  { key: "matters", label: "Matters", table: "matters", route: "/matters", text: ["name","matter_number","practice_area","stage","priority","responsible_attorney","description"], title: ["name"], detail: ["matter_number","practice_area","stage"], dates: ["opened_date","next_deadline"] },
  { key: "intakes", label: "Intakes", table: "intakes", route: "/intakes", text: ["name","email","phone","practice_area","source","stage","owner_name","notes"], title: ["name"], detail: ["practice_area","email","stage"] },
  { key: "tasks", label: "Tasks", table: "tasks", route: "/tasks", text: ["title","assignee_name","priority","status","notes"], title: ["title"], detail: ["assignee_name","status","due_date"], dates: ["due_date"] },
  { key: "events", label: "Appointments", table: "events", route: "/events", text: ["title","event_type","location","notes"], title: ["title"], detail: ["starts_at","location"], timestamps: ["starts_at","ends_at"] },
  { key: "documents", label: "Documents", table: "documents", route: "/documents", text: ["name","document_type","status","version","owner_name","mime_type"], title: ["name"], detail: ["document_type","owner_name","status"], numbers: ["file_size"] },
  { key: "time-entries", label: "Time entries", table: "time_entries", route: "/time-entries", text: ["description","timekeeper_name"], title: ["description"], detail: ["timekeeper_name","entry_date","hours"], dates: ["entry_date"], numbers: ["hours","rate"] },
  { key: "invoices", label: "Invoices", table: "invoices", route: "/invoices", text: ["invoice_number","status"], title: ["invoice_number"], detail: ["status","amount","balance"], dates: ["issue_date","due_date"], numbers: ["amount","balance"] },
  { key: "templates", label: "Templates", table: "document_templates", route: "/templates", text: ["name","description","category","subsection"], title: ["name"], detail: ["category","subsection"] },
  { key: "intake-forms", label: "Submitted intake forms", table: "client_intake_responses", route: "/intakes", text: ["legal_name","preferred_name","pronouns","email","phone","address_line_1","address_line_2","city","state","postal_code","preferred_contact","practice_area","incident_location","opposing_parties","matter_summary","injuries_or_damages","insurance_information","referral_source","signature_name"], title: ["preferred_name","legal_name"], detail: ["practice_area","email"], dates: ["date_of_birth","incident_date"], timestamps: ["submitted_at"], extra: ["intake_id"] },
  { key: "attachments", label: "Intake attachments", table: "client_intake_attachments", route: "/documents", text: ["file_name","mime_type"], title: ["file_name"], detail: ["mime_type","file_size"], numbers: ["file_size"], extra: ["document_id","link_id"] },
  { key: "communications", label: "Communications", table: "client_communications", route: "/clients", text: ["subject","notes","summary","channel","direction","status","from_number","to_number"], title: ["subject","summary","channel"], detail: ["channel","direction","status"], timestamps: ["started_at","ended_at"], extra: ["client_id"] },
  { key: "intake-links", label: "Intake invitations", table: "client_intake_links", route: "/intake-links", text: ["recipient_name","recipient_email","practice_area"], title: ["recipient_name"], detail: ["recipient_email","practice_area"], timestamps: ["expires_at","submitted_at"] },
  { key: "audit", label: "Audit log", table: "audit_log", route: "/audit", text: ["table_name","action","actor_email"], title: ["action","table_name"], detail: ["actor_email","created_at"] },
  { key: "users", label: "Staff directory", table: "profiles", route: "/users", text: ["full_name","email","role","status"], title: ["full_name","email"], detail: ["email","role","status"], adminOnly: true },
];

export const searchRequestSchema = z.object({
  q: z.string().trim().min(2).max(120).refine((value) => !/[\u0000-\u001f*]/.test(value), "Enter a search without control characters or wildcards."),
  category: z.string().default("all").refine((value) => value === "all" || searchSources.some((source) => source.key === value)),
  page: z.number().int().min(0).max(10000).default(0),
});
export const recordIdSchema = z.string().uuid();
export const SEARCH_PAGE_SIZE = 10;

export function canSearch(profile: { role: string; status: string; firm_id: string | null; must_change_password?: boolean } | null) {
  return !!profile?.firm_id && profile.status === "active" && !profile.must_change_password
    && ["admin","attorney","staff","billing","readonly"].includes(profile.role);
}
export function sourcesForRole(role: string) {
  return searchSources.filter((source) => !source.adminOnly || role === "admin");
}
export function searchColumns(source: SearchSource) {
  return [...new Set(["id", ...source.text, ...source.title, ...source.detail, ...(source.extra || [])])].join(",");
}
export function searchFilter(source: SearchSource, query: string) {
  // Quote every filter value, then escape LIKE and PostgREST grammar separately.
  const literal = query.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${literal}%`.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const filters = source.text.map((column) => `${column}.ilike."${pattern}"`);
  if (/^-?\d+(?:\.\d+)?$/.test(query) && Math.abs(Number(query)) <= Number.MAX_SAFE_INTEGER) {
    filters.push(...(source.numbers || []).filter((column) => column !== "file_size" || Number.isInteger(Number(query))).map((column) => `${column}.eq.${Number(query)}`));
  }
  if (validDateKey(query) && Number(query.slice(0, 4)) >= 1900 && Number(query.slice(0, 4)) <= 9998) {
    filters.push(...(source.dates || []).map((column) => `${column}.eq.${query}`));
    const start = firmDateTimeToIso(`${query}T00:00`);
    const end = firmDateTimeToIso(`${addDays(query, 1)}T00:00`);
    filters.push(...(source.timestamps || []).map((column) => `and(${column}.gte.${start},${column}.lt.${end})`));
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query)) filters.push(`id.eq.${query}`);
  return filters.join(",");
}

export type SearchResult = { id: string; category: string; title: string; detail: string; snippet: string; href: string };
export type SearchGroup = { key: string; label: string; results: SearchResult[]; hasMore: boolean };
export type SearchResponse = { groups: SearchGroup[]; categories: { key: string; label: string }[]; page: number; partial: boolean; unavailable: string[] };

function excerpt(value: string, query: string) {
  const match = value.toLowerCase().indexOf(query.toLowerCase());
  const start = Math.max(0, match - 65);
  return `${start ? "…" : ""}${value.slice(start, start + 190)}${value.length > start + 190 ? "…" : ""}`;
}
export function searchResult(source: SearchSource, row: Record<string, unknown>, query: string): SearchResult {
  const value = (field: string) => typeof row[field] === "string" || typeof row[field] === "number" ? String(row[field]) : "";
  const title = source.key === "audit" ? source.title.map(value).filter(Boolean).join(" · ") : source.title.map(value).find(Boolean);
  const matched = source.text.map(value).find((text) => text.toLowerCase().includes(query.toLowerCase()));
  let href = `${source.route}?record=${encodeURIComponent(value("id"))}`;
  if (source.key === "clients") href = `/clients/${encodeURIComponent(value("id"))}`;
  if (source.key === "communications") href = `/clients/${encodeURIComponent(value("client_id"))}?communication=${encodeURIComponent(value("id"))}#communication-${encodeURIComponent(value("id"))}`;
  if (source.key === "intake-forms") href = row.intake_id ? `/intakes?record=${encodeURIComponent(value("intake_id"))}` : "/intakes";
  if (source.key === "attachments") href = row.document_id ? `/documents?record=${encodeURIComponent(value("document_id"))}#document-${encodeURIComponent(value("document_id"))}` : `/intake-links?record=${encodeURIComponent(value("link_id"))}#intake-link-${encodeURIComponent(value("link_id"))}`;
  if (source.key === "events" && row.starts_at) href = `/events?week=${weekStart(firmDateTime(value("starts_at")).slice(0,10))}#event-${encodeURIComponent(value("id"))}`;
  if (source.key === "documents") href = `/documents?record=${encodeURIComponent(value("id"))}#document-${encodeURIComponent(value("id"))}`;
  if (source.key === "templates") href = `/templates?record=${encodeURIComponent(value("id"))}#template-${encodeURIComponent(value("id"))}`;
  if (source.key === "intake-links") href = `/intake-links?record=${encodeURIComponent(value("id"))}#intake-link-${encodeURIComponent(value("id"))}`;
  return { id: value("id"), category: source.key, title: (title || source.label).slice(0,180),
    detail: source.detail.map(value).filter(Boolean).join(" · ").slice(0,200),
    snippet: matched ? excerpt(matched, query) : "", href };
}
