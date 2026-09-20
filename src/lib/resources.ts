export type ResourceField = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "textarea" | "select";
  required?: boolean;
  options?: readonly string[];
  defaultValue?: string;
};

export const resources = {
  clients: {
    title: "Clients",
    singular: "Client",
    table: "clients",
    columns: ["name", "email", "phone", "status"],
    labels: { name: "Client", email: "Email", phone: "Phone", status: "Status" },
    fields: [
      { name: "name", label: "Client name", required: true },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone", type: "tel" },
      { name: "preferred_contact", label: "Preferred contact", type: "select", options: ["Email", "Phone", "Text"] },
      { name: "address", label: "Address", type: "textarea" },
      { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"], defaultValue: "Active" },
    ],
  },
  matters: { title: "Matters", table: "matters", columns: ["matter_number", "name", "practice_area", "stage", "next_deadline"], labels: { matter_number: "Matter no.", name: "Matter", practice_area: "Practice area", stage: "Stage", next_deadline: "Next deadline" } },
  intakes: { title: "Intake Pipeline", table: "intakes", columns: ["name", "practice_area", "source", "stage", "owner_name"], labels: { name: "Prospect", practice_area: "Practice area", source: "Source", stage: "Stage", owner_name: "Owner" } },
  tasks: { title: "Tasks", table: "tasks", columns: ["title", "assignee_name", "due_date", "priority", "status"], labels: { title: "Task", assignee_name: "Assignee", due_date: "Due", priority: "Priority", status: "Status" } },
  events: { title: "Calendar", table: "events", columns: ["starts_at", "title", "event_type", "location"], labels: { starts_at: "Starts", title: "Event", event_type: "Type", location: "Location" } },
  documents: { title: "Documents", table: "documents", columns: ["name", "document_type", "status", "version", "owner_name"], labels: { name: "Document", document_type: "Type", status: "Status", version: "Version", owner_name: "Owner" } },
  "time-entries": { title: "Time Entries", table: "time_entries", columns: ["entry_date", "timekeeper_name", "description", "hours", "rate", "billed"], labels: { entry_date: "Date", timekeeper_name: "Timekeeper", description: "Description", hours: "Hours", rate: "Rate", billed: "Billed" } },
  invoices: { title: "Invoices", table: "invoices", columns: ["invoice_number", "issue_date", "due_date", "status", "amount", "balance"], labels: { invoice_number: "Invoice", issue_date: "Issued", due_date: "Due", status: "Status", amount: "Amount", balance: "Balance" } },
} as const;

export type ResourceKey = keyof typeof resources;

export function formFieldsFor(resource: ResourceKey): readonly ResourceField[] {
  const config = resources[resource] as { columns: readonly string[]; labels: Record<string, string>; fields?: readonly ResourceField[] };
  return config.fields || config.columns.slice(0, 6).map((name) => ({
    name,
    label: config.labels[name] || name,
    required: ["name", "title", "email"].includes(name),
  }));
}

export function sanitizeResourcePayload(resource: ResourceKey, value: unknown, emptyValues: "omit" | "null" = "omit") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const allowed = new Set(formFieldsFor(resource).map((field) => field.name));
  return Object.fromEntries(Object.entries(source)
    .filter(([key, fieldValue]) => allowed.has(key) && (emptyValues === "null" || fieldValue !== ""))
    .map(([key, fieldValue]) => [key, fieldValue === "" ? null : fieldValue]));
}
