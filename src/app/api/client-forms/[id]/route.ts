import { renderClientForm } from "@/lib/form-renderer";
import { z } from "zod";
import { formContext, formJson } from "@/lib/form-auth";
import {
  formFieldsSchema,
  valuesSchema,
  validateAnswers,
} from "@/lib/client-forms";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const schema = z
  .object({
    answers: valuesSchema,
    revision: z.number().int().positive(),
    complete: z.boolean().default(false),
    reviewed: z.boolean().default(false),
  })
  .strict();
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const c = await formContext(true);
  if (c.error) return c.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return formJson({ error: "Invalid form." }, 400);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return formJson({ error: "Invalid form answers." }, 400);
  const { data: form, error } = await c.supabase
    .from("client_forms")
    .select("id,fields,status,revision,storage_path,file_format")
    .eq("firm_id", c.profile.firm_id)
    .eq("id", id)
    .maybeSingle();
  if (error || !form) return formJson({ error: "Form unavailable." }, 404);
  if (form.status === "completed")
    return formJson(
      { error: "Completed forms are locked. Create a new copy to revise." },
      409,
    );
  const fields = formFieldsSchema.safeParse(form.fields);
  if (!fields.success)
    return formJson({ error: "Form mapping is invalid." }, 409);
  const errors = validateAnswers(
    fields.data,
    parsed.data.answers,
    parsed.data.complete,
  );
  if (parsed.data.complete && !parsed.data.reviewed)
    errors.push("Review all answers before marking complete.");
  if (errors.length) return formJson({ error: errors.join(" ") }, 400);
  if (parsed.data.complete) {
    const source = await c.supabase.storage
      .from("document-templates")
      .download(form.storage_path);
    if (source.error || !source.data)
      return formJson(
        { error: "Source template unavailable. Draft remains editable." },
        503,
      );
    try {
      await renderClientForm(
        new Uint8Array(await source.data.arrayBuffer()),
        form.file_format,
        fields.data,
        parsed.data.answers,
      );
    } catch (e) {
      return formJson(
        {
          error:
            e instanceof Error
              ? e.message
              : "The answers could not be placed in this document.",
        },
        422,
      );
    }
  }
  const result = await c.supabase
    .from("client_forms")
    .update({
      answers: parsed.data.answers,
      status: parsed.data.complete ? "completed" : "draft",
      revision: parsed.data.revision + 1,
      completed_by: parsed.data.complete ? c.user.id : null,
      completed_at: parsed.data.complete ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("firm_id", c.profile.firm_id)
    .eq("revision", parsed.data.revision)
    .eq("status", "draft")
    .select("revision,status,updated_at")
    .maybeSingle();
  if (result.error) return formJson({ error: "Unable to save form." }, 400);
  if (!result.data)
    return formJson(
      { error: "This form changed in another session. Reload before saving." },
      409,
    );
  return formJson(result.data);
}
