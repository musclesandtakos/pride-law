import { createClient } from "@/lib/supabase/server";
import { TemplateLibrary } from "@/components/template-library";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [templates, clients, me] = await Promise.all([
    supabase
      .from("document_templates")
      .select("id,name,description,category,subsection,placeholder_fields,updated_at")
      .order("sort_order")
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id,name,phone,email").order("name"),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
  ]);

  if (templates.error) throw new Error(templates.error.message);
  if (clients.error) throw new Error(clients.error.message);

  return <TemplateLibrary initial={templates.data || []} clients={clients.data || []} canManage={me.data?.role === "admin"} />;
}
