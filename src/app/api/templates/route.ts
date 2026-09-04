import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDocxFile, makeTemplateStoragePath, parseTemplateFields } from "@/lib/templates";

export const runtime = "edge";

const bucket = "document-templates";

async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: Response.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,firm_id,role")
    .eq("id", user.id)
    .single();

  if (!profile?.firm_id) {
    return { supabase, error: Response.json({ error: "Your account is not assigned to a firm" }, { status: 403 }) };
  }

  return { supabase, profile };
}

export async function GET() {
  const context = await getProfile();
  if ("error" in context) return context.error;

  const { data, error } = await context.supabase
    .from("document_templates")
    .select("id,name,description,category,placeholder_fields,sort_order,created_at,updated_at")
    .order("sort_order")
    .order("created_at", { ascending: false });

  return error
    ? Response.json({ error: error.message }, { status: 400 })
    : Response.json(data || []);
}

export async function POST(request: NextRequest) {
  const context = await getProfile();
  if ("error" in context) return context.error;
  if (context.profile.role !== "admin") {
    return Response.json({ error: "Administrator access required" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Please choose a .docx template file" }, { status: 400 });
  }

  if (!isDocxFile(file)) {
    return Response.json({ error: "Only .docx templates are supported" }, { status: 400 });
  }

  const templateName = String(formData.get("name") || "").trim() || file.name.replace(/\.docx$/i, "");
  const description = String(formData.get("description") || "").trim() || null;
  const category = String(formData.get("category") || "").trim() || "General";
  const sortOrder = Number(String(formData.get("sortOrder") || "0"));
  const placeholderFields = parseTemplateFields(String(formData.get("placeholderFields") || ""));

  const storagePath = makeTemplateStoragePath(context.profile.firm_id, file.name, crypto.randomUUID());
  const data = await file.arrayBuffer();
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
      uploaded_by: context.profile.id,
      name: templateName,
      description,
      category,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      placeholder_fields: placeholderFields,
      storage_path: storagePath,
    })
    .select("id,name,description,category,placeholder_fields,sort_order,created_at,updated_at")
    .single();

  if (record.error) {
    await context.supabase.storage.from(bucket).remove([storagePath]);
    return Response.json({ error: record.error.message }, { status: 400 });
  }

  return Response.json(record.data, { status: 201 });
}
