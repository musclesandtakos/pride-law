import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditor } from "@/components/template-editor";

export const dynamic = "force-dynamic";

export default async function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const template = await supabase
    .from("document_templates")
    .select("id,name,description,category,placeholder_fields,storage_path")
    .eq("id", id)
    .maybeSingle();

  if (template.error) throw new Error(template.error.message);
  if (!template.data) notFound();

  const signed = await supabase.storage.from("document-templates").createSignedUrl(template.data.storage_path, 60 * 60);

  return <TemplateEditor template={template.data} downloadUrl={signed.data?.signedUrl || null} />;
}
