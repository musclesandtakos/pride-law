import { notFound, redirect } from "next/navigation";
import { formContext } from "@/lib/form-auth";
import { TemplateMapping } from "@/components/template-mapping";
import { FormField } from "@/lib/client-forms";
export const dynamic = "force-dynamic";
export default async function TemplateMappingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const c = await formContext(true, true);
  if (c.error) redirect("/templates");
  const { id } = await params;
  const { data: t } = await c
    .supabase!.from("document_templates")
    .select(
      "id,name,file_format,field_schema,review_status,review_note,storage_path",
    )
    .eq("firm_id", c.profile!.firm_id)
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();
  const signed = await c
    .supabase!.storage.from("document-templates")
    .createSignedUrl(t.storage_path, 300);
  return (
    <TemplateMapping
      template={{
        id: t.id,
        name: t.name,
        file_format: t.file_format,
        fields: t.field_schema as FormField[],
        review_note: t.review_note || "",
        review_status: t.review_status,
      }}
      sourceUrl={signed.data?.signedUrl || null}
    />
  );
}
