import { z } from "zod";
import { formContext, formJson } from "@/lib/form-auth";
import { formFieldsSchema, validateAnswers } from "@/lib/client-forms";
import { renderClientForm } from "@/lib/form-renderer";
import { sanitizeFileName } from "@/lib/templates";
export const runtime = "nodejs";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const c = await formContext();
  if (c.error) return c.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return formJson({ error: "Invalid form." }, 400);
  const { data: form, error } = await c.supabase
    .from("client_forms")
    .select("template_name,fields,answers,status,storage_path,file_format")
    .eq("firm_id", c.profile.firm_id)
    .eq("id", id)
    .maybeSingle();
  if (error || !form) return formJson({ error: "Form unavailable." }, 404);
  const fields = formFieldsSchema.safeParse(form.fields);
  if (
    form.status !== "completed" ||
    !fields.success ||
    validateAnswers(fields.data, form.answers, true).length
  )
    return formJson(
      { error: "Complete and review the saved form before exporting." },
      409,
    );
  const source = await c.supabase.storage
    .from("document-templates")
    .download(form.storage_path);
  if (source.error || !source.data)
    return formJson({ error: "Source template unavailable." }, 503);
  try {
    const bytes = await renderClientForm(
      new Uint8Array(await source.data.arrayBuffer()),
      form.file_format,
      fields.data,
      form.answers,
    );
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type":
          form.file_format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${sanitizeFileName(form.template_name)}.${form.file_format}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return formJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate document.",
      },
      422,
    );
  }
}
