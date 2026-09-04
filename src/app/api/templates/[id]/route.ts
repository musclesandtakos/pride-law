import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseTemplateFields } from "@/lib/templates";

export const runtime = "edge";

const bucket = "document-templates";

async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: Response.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabase.from("profiles").select("firm_id,role").eq("id", user.id).single();
  if (!profile?.firm_id) {
    return { supabase, error: Response.json({ error: "Your account is not assigned to a firm" }, { status: 403 }) };
  }

  return { supabase, profile };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await getProfile();
  if ("error" in context) return context.error;

  const { id } = await params;
  const template = await context.supabase
    .from("document_templates")
    .select("id,name,description,category,placeholder_fields,sort_order,storage_path,updated_at")
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
  if ("error" in context) return context.error;
  if (context.profile.role !== "admin") {
    return Response.json({ error: "Administrator access required" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const payload: Record<string, unknown> = {};

  if (typeof body.name === "string") payload.name = body.name.trim();
  if (typeof body.description === "string") payload.description = body.description.trim() || null;
  if (typeof body.category === "string") payload.category = body.category.trim() || "General";
  if (typeof body.sortOrder === "number") payload.sort_order = body.sortOrder;
  if (typeof body.placeholderFields === "string") payload.placeholder_fields = parseTemplateFields(body.placeholderFields);
  if (Array.isArray(body.placeholder_fields)) payload.placeholder_fields = body.placeholder_fields;

  const updated = await context.supabase
    .from("document_templates")
    .update(payload)
    .eq("id", id)
    .select("id,name,description,category,placeholder_fields,sort_order,created_at,updated_at")
    .single();

  return updated.error
    ? Response.json({ error: updated.error.message }, { status: 400 })
    : Response.json(updated.data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await getProfile();
  if ("error" in context) return context.error;
  if (context.profile.role !== "admin") {
    return Response.json({ error: "Administrator access required" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await context.supabase
    .from("document_templates")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (existing.error) return Response.json({ error: existing.error.message }, { status: 404 });

  const removeObject = await context.supabase.storage.from(bucket).remove([existing.data.storage_path]);
  if (removeObject.error) return Response.json({ error: removeObject.error.message }, { status: 400 });

  const removeRow = await context.supabase.from("document_templates").delete().eq("id", id);
  return removeRow.error
    ? Response.json({ error: removeRow.error.message }, { status: 400 })
    : Response.json({ deleted: true });
}
