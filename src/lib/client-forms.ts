import { z } from "zod";

export const prefillKeys = [
  "",
  "client_name",
  "client_email",
  "client_phone",
  "client_address",
  "preferred_contact",
  "date_of_birth",
  "incident_date",
  "incident_location",
  "opposing_parties",
  "matter_summary",
  "injuries_or_damages",
  "insurance_information",
  "matter_number",
  "attorney_name",
] as const;
export const formFieldSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
    label: z.string().trim().min(1).max(300),
    section: z.string().max(160).default("Client information"),
    type: z
      .enum(["text", "textarea", "date", "select", "checkbox"])
      .default("text"),
    required: z.boolean().default(true),
    prefill: z.enum(prefillKeys).default(""),
    options: z.array(z.string().min(1).max(200)).max(60).default([]),
    target: z.string().max(200).optional(),
    overlay: z
      .object({
        page: z.number().int().min(0).max(199),
        x: z.number().min(0).max(2000),
        y: z.number().min(0).max(2000),
        width: z.number().positive().max(2000),
        height: z.number().positive().max(2000),
      })
      .optional(),
  })
  .strict();
export const formFieldsSchema = z
  .array(formFieldSchema)
  .max(600)
  .superRefine((fields, ctx) => {
    if (new Set(fields.map((f) => f.key)).size !== fields.length)
      ctx.addIssue({ code: "custom", message: "Field keys must be unique." });
    const targets = fields.flatMap((f) => (f.target ? [f.target] : []));
    if (new Set(targets).size !== targets.length)
      ctx.addIssue({
        code: "custom",
        message: "Each document field can be mapped only once.",
      });
    if (fields.some((f) => f.target && f.overlay))
      ctx.addIssue({
        code: "custom",
        message: "Choose a source field or a placement box, not both.",
      });
    if (fields.some((f) => f.type === "select" && !f.options.length))
      ctx.addIssue({ code: "custom", message: "Choice fields need options." });
    if (
      fields.some((f) =>
        /\b(cvv|cvc|card number|security code)\b/i.test(
          `${f.label} ${f.key.replaceAll("_", " ")}`,
        ),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Use hosted payment collection for card details.",
      });
  });
export type FormField = z.infer<typeof formFieldSchema>;
export type FormValues = Record<string, string>;
export type ClientForm = {
  id: string;
  client_id: string;
  matter_id: string | null;
  template_name: string;
  file_format: string;
  storage_path: string;
  fields: FormField[];
  answers: FormValues;
  status: "draft" | "completed";
  revision: number;
  updated_at: string;
};
export const valuesSchema = z
  .record(z.string().max(20000))
  .refine((values) => Object.keys(values).length <= 600);
export function validateAnswers(
  fields: FormField[],
  answers: FormValues,
  complete = false,
) {
  const errors: string[] = [];
  const keys = new Set(fields.map((f) => f.key));
  if (Object.keys(answers).some((key) => !keys.has(key)))
    errors.push("Unrecognized form field.");
  for (const field of fields) {
    const value = answers[field.key] || "";
    if (complete && field.required && !value.trim())
      errors.push(`${field.label} is required.`);
    if (value && field.type === "select" && !field.options.includes(value))
      errors.push(`${field.label}: select a listed answer.`);
    if (value && field.type === "checkbox" && !["Yes", "No"].includes(value))
      errors.push(`${field.label}: choose Yes or No.`);
    if (
      value &&
      field.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      errors.push(`${field.label}: enter a valid date.`);
  }
  return errors;
}
export function prefillAnswers(
  fields: FormField[],
  client: Record<string, unknown>,
  intake: Record<string, unknown> | null,
  matter: Record<string, unknown> | null,
) {
  const source: Record<string, unknown> = {
    ...intake,
    client_name: intake?.legal_name || client.name,
    client_email: client.email,
    client_phone: client.phone,
    client_address: client.address,
    preferred_contact: client.preferred_contact,
    matter_number: matter?.matter_number,
    attorney_name: matter?.responsible_attorney,
  };
  // Signatures, witnesses and notarial acts are never inferred from an intake or staff defaults.
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      field.prefill && source[field.prefill] != null
        ? String(source[field.prefill])
        : "",
    ]),
  );
}
export function templateReady(format: string, fields: FormField[]) {
  return (
    fields.length > 0 &&
    ["pdf", "docx"].includes(format) &&
    fields.every((f) =>
      format === "docx" ? !!f.target : !!f.target || !!f.overlay,
    )
  );
}
