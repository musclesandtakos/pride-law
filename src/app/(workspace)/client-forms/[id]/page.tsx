import { notFound, redirect } from "next/navigation";
import { ClientFormEditor } from "@/components/client-form-editor";
import { formContext } from "@/lib/form-auth";
import { ClientForm } from "@/lib/client-forms";
export const dynamic = "force-dynamic";
export default async function ClientFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const c = await formContext();
  if (c.error) redirect("/login");
  const { id } = await params;
  const { data: form, error } = await c
    .supabase!.from("client_forms")
    .select(
      "id,client_id,matter_id,template_name,file_format,fields,answers,status,revision,updated_at",
    )
    .eq("firm_id", c.profile!.firm_id)
    .eq("id", id)
    .maybeSingle();
  if (error || !form) notFound();
  return (
    <ClientFormEditor
      initial={form as ClientForm}
      canEdit={["admin", "staff", "attorney"].includes(c.profile!.role)}
    />
  );
}
