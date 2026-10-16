import { z } from "zod";
import { formContext, formJson } from "@/lib/form-auth";
import {
  formFieldsSchema,
  prefillAnswers,
  templateReady,
} from "@/lib/client-forms";
export const dynamic = "force-dynamic";
const schema = z
  .object({
    client_id: z.string().uuid(),
    matter_id: z.string().uuid(),
    template_ids: z.array(z.string().uuid()).min(1).max(25),
    intake_response_id: z.string().uuid().optional(),
  })
  .strict();
export async function GET(request: Request) {
  const c = await formContext();
  if (c.error) return c.error;
  const client = new URL(request.url).searchParams.get("client");
  if (!z.string().uuid().safeParse(client).success)
    return formJson({ error: "Choose a client." }, 400);
  const result = await c.supabase
    .from("client_forms")
    .select(
      "id,client_id,matter_id,template_name,file_format,status,revision,updated_at",
    )
    .eq("firm_id", c.profile.firm_id)
    .eq("client_id", client)
    .order("updated_at", { ascending: false });
  return result.error
    ? formJson(
        {
          error:
            "Saved forms are not available. Confirm the form workflow migration has been applied.",
        },
        503,
      )
    : formJson(result.data);
}
export async function POST(request: Request) {
  const c = await formContext(true);
  if (c.error) return c.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return formJson(
      { error: "Choose a client, matter, and up to 25 templates." },
      400,
    );
  const body = parsed.data;
  const [client, matter, templates] = await Promise.all([
    c.supabase
      .from("clients")
      .select("id,name,email,phone,address,preferred_contact")
      .eq("firm_id", c.profile.firm_id)
      .eq("id", body.client_id)
      .maybeSingle(),
    c.supabase
      .from("matters")
      .select("id,client_id,matter_number,responsible_attorney")
      .eq("firm_id", c.profile.firm_id)
      .eq("client_id", body.client_id)
      .eq("id", body.matter_id)
      .maybeSingle(),
    c.supabase
      .from("document_templates")
      .select("id,name,storage_path,file_format,field_schema,review_status")
      .eq("firm_id", c.profile.firm_id)
      .in("id", [...new Set(body.template_ids)]),
  ]);
  if (client.error || matter.error || templates.error)
    return formJson(
      {
        error:
          "Unable to load the selected records. Confirm the form workflow migration is installed.",
      },
      503,
    );
  if (
    !client.data ||
    !matter.data ||
    templates.data?.length !== new Set(body.template_ids).size
  )
    return formJson(
      { error: "A selected record is unavailable for this client." },
      404,
    );
  let intake: Record<string, unknown> | null = null;
  if (body.intake_response_id) {
    const r = await c.supabase
      .from("client_intake_responses")
      .select("*")
      .eq("firm_id", c.profile.firm_id)
      .eq("id", body.intake_response_id)
      .maybeSingle();
    if (r.error || !r.data)
      return formJson({ error: "The selected intake is unavailable." }, 404);
    // Explicit staff selection is required; do not merge people by name/email similarity.
    intake = r.data;
  }
  const rows = [];
  for (const template of templates.data || []) {
    const fields = formFieldsSchema.safeParse(template.field_schema);
    if (
      template.review_status !== "ready" ||
      !fields.success ||
      !templateReady(template.file_format, fields.data)
    )
      return formJson(
        {
          error: `${template.name} needs administrator review and field mapping.`,
        },
        409,
      );
    rows.push({
      firm_id: c.profile.firm_id,
      client_id: client.data.id,
      matter_id: matter.data.id,
      template_id: template.id,
      template_name: template.name,
      storage_path: template.storage_path,
      file_format: template.file_format,
      fields: fields.data,
      answers: prefillAnswers(fields.data, client.data, intake, matter.data),
      created_by: c.user.id,
      source_intake_response_id: body.intake_response_id || null,
    });
  }
  const result = await c.supabase
    .from("client_forms")
    .insert(rows)
    .select("id,template_name");
  return result.error
    ? formJson({ error: "Unable to create client forms." }, 400)
    : formJson(result.data, 201);
}
