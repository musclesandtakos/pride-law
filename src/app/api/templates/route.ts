import { formContext } from "@/lib/form-auth";
import { inspectTemplate } from "@/lib/form-renderer";
import { formFieldsSchema } from "@/lib/client-forms";
import { NextRequest } from "next/server";
import { makeTemplateStoragePath, parseTemplateFields, withStandardNameFields } from "@/lib/templates";

export const runtime = "nodejs";

const bucket = "document-templates";

async function getProfile() {
  return formContext();
}

export async function GET() {
  const context = await getProfile();
  if (context.error) return context.error;

  const { data, error } = await context.supabase
    .from("document_templates")
    .select("id,name,description,category,subsection,placeholder_fields,sort_order,created_at,updated_at")
    .order("sort_order")
    .order("created_at", { ascending: false });

  return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json(data || []);
}

export async function POST(request: NextRequest) {
  const context = await getProfile();
  if (context.error) return context.error;
  if (context.profile.role !== "admin") {
    return Response.json({ error: "Administrator access required" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Please choose a PDF, Word template, or legacy Word source" }, { status: 400 });
  }

  const format = file.name.split(".").pop()?.toLowerCase();
  if (!format || !["pdf","docx","doc"].includes(format) || file.size < 1 || file.size > 10*1024*1024) {
    return Response.json({ error: "Choose a PDF or Word file smaller than 10 MB." }, { status: 400 });
  }
  let fields;
  const bytes = new Uint8Array(await file.arrayBuffer());
  try { fields = formFieldsSchema.parse(await inspectTemplate(bytes,format)); }
  catch { return Response.json({error:"Unable to read template. Check the file and remove unsupported or payment-card fields before uploading."},{status:400}); }


  const templateName = String(formData.get("name") || "").trim() || file.name.replace(/\.docx$/i, "");
  const description = String(formData.get("description") || "").trim() || null;
  const category = String(formData.get("category") || "").trim() || "General";
  const subsection = String(formData.get("subsection") || "").trim() || "General forms";
  const sortOrder = Number(String(formData.get("sortOrder") || "0"));
  const placeholderFields = withStandardNameFields(parseTemplateFields(String(formData.get("placeholderFields") || "")));

  const storagePath = makeTemplateStoragePath(context.profile.firm_id, file.name, crypto.randomUUID());
  const data = bytes;
  const upload = await context.supabase.storage.from(bucket).upload(storagePath, data, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  if (upload.error) return Response.json({ error: upload.error.message }, { status: 400 });

  const record = await context.supabase
    .from("document_templates")
    .insert({
      firm_id: context.profile.firm_id,
      uploaded_by: context.user.id,
      name: templateName,
      description,
      category,
      subsection,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      placeholder_fields: placeholderFields,
      storage_path: storagePath,
      file_format: format,
      field_schema: fields,
      review_status: "needs_review",
    })
    .select("id,name,description,category,subsection,placeholder_fields,sort_order,created_at,updated_at")
    .single();

  if (record.error) {
    await context.supabase.storage.from(bucket).remove([storagePath]);
    return Response.json({ error: record.error.message }, { status: 400 });
  }

  return Response.json(record.data, { status: 201 });
}
