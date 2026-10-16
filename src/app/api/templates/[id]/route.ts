import { NextRequest } from "next/server";
import { formContext } from "@/lib/form-auth";
import { parseTemplateFields, withStandardNameFields } from "@/lib/templates";

export const runtime = "edge";

const bucket = "document-templates";

async function getProfile() { return formContext(); }

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await getProfile();
  if (context.error) return context.error;

  const { id } = await params;
  const template = await context.supabase
    .from("document_templates")
    .select("id,name,description,category,subsection,placeholder_fields,sort_order,storage_path,updated_at")
    .eq("id", id)
    .single();

  if (template.error) return Response.json({ error: template.error.message }, { status: 404 });

  const signed = await context.supabase.storage.from(bucket).createSignedUrl(template.data.storage_path, 60 * 60);
  return Response.json({
    ...template.data,
    download_url: signed.data?.signedUrl || null,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await getProfile();
  if (context.error) return context.error;
  if (context.profile.role !== "admin") {
    return Response.json({ error: "Administrator access required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const payload: Record<string, unknown> = {};

  if (typeof body.name === "string") payload.name = body.name.trim();
  if (typeof body.description === "string") payload.description = body.description.trim() || null;
  if (typeof body.category === "string") payload.category = body.category.trim() || "General";
  if (typeof body.subsection === "string") payload.subsection = body.subsection.trim() || "General forms";
  if (typeof body.sortOrder === "number") payload.sort_order = body.sortOrder;
  if (typeof body.placeholderFields === "string") payload.placeholder_fields = withStandardNameFields(parseTemplateFields(body.placeholderFields));
  if (Array.isArray(body.placeholder_fields)) payload.placeholder_fields = withStandardNameFields(body.placeholder_fields.filter((field: unknown): field is string => typeof field === "string"));

  const updated = await context.supabase
    .from("document_templates")
    .update(payload)
    .eq("id", id)
    .select("id,name,description,category,subsection,placeholder_fields,sort_order,created_at,updated_at")
    .single();

  return updated.error ? Response.json({ error: updated.error.message }, { status: 400 }) : Response.json(updated.data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await getProfile();
  if (context.error) return context.error;
  if (context.profile.role !== "admin") {
    return Response.json({ error: "Administrator access required" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await context.supabase.from("document_templates").select("storage_path").eq("id", id).single();

  if (existing.error) return Response.json({ error: existing.error.message }, { status: 404 });

  const used = await context.supabase.from("client_forms").select("id",{count:"exact",head:true}).eq("template_id",id);
  if (used.error || used.count) return Response.json({error:"Templates used by client forms must be retained. Keep this template for its saved client copies."},{status:409});
  // Delete the row first: the FK serializes this against concurrent client-form creation.
  const removeRow = await context.supabase.from("document_templates").delete().eq("id", id);
  if (removeRow.error) return Response.json({ error: "This template is still in use." }, { status: 409 });
  const removeObject = await context.supabase.storage.from(bucket).remove([existing.data.storage_path]);
  // An orphaned private source is safer than removing bytes a client snapshot still references.
  return Response.json({ deleted: true, ...(removeObject.error ? {warning:"Template retired; private source cleanup is pending."} : {}) });
}
