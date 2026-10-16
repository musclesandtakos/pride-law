import { z } from "zod";
import { formContext, formJson } from "@/lib/form-auth";
import { formFieldsSchema, templateReady } from "@/lib/client-forms";
import { renderClientForm } from "@/lib/form-renderer";
export const runtime = "nodejs";
const schema = z
  .object({
    fields: formFieldsSchema,
    ready: z.boolean(),
    review_note: z.string().max(2000),
  })
  .strict();
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const c = await formContext(true, true);
  if (c.error) return c.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return formJson(
      { error: parsed.error.issues.map((x) => x.message).join(" ") },
      400,
    );
  const { id } = await params;
  const { data: template } = await c.supabase
    .from("document_templates")
    .select("id,file_format,storage_path")
    .eq("id", id)
    .eq("firm_id", c.profile.firm_id)
    .maybeSingle();
  if (!template) return formJson({ error: "Template unavailable." }, 404);
  if (parsed.data.ready) {
    if (
      !templateReady(template.file_format, parsed.data.fields) ||
      !parsed.data.review_note.trim()
    )
      return formJson(
        {
          error:
            "Map all fields and confirm source content and branding were reviewed.",
        },
        400,
      );
    const source = await c.supabase.storage
      .from("document-templates")
      .download(template.storage_path);
    if (source.error)
      return formJson({ error: "Source template unavailable." }, 503);
    try {
      await renderClientForm(
        new Uint8Array(await source.data!.arrayBuffer()),
        template.file_format,
        parsed.data.fields,
        Object.fromEntries(parsed.data.fields.map((f) => [f.key, ""])),
      );
    } catch {
      return formJson(
        { error: "Field mapping does not match the source file." },
        400,
      );
    }
  }
  const result = await c.supabase
    .from("document_templates")
    .update({
      field_schema: parsed.data.fields,
      review_status: parsed.data.ready ? "ready" : "needs_review",
      review_note: parsed.data.review_note,
    })
    .eq("id", id)
    .eq("firm_id", c.profile.firm_id)
    .select("id")
    .single();
  return result.error
    ? formJson({ error: "Unable to save mapping." }, 400)
    : formJson(result.data);
}
