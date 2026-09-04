import { createClient } from "@/lib/supabase/server";
import { TemplateLibrary } from "@/components/template-library";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [templates, me] = await Promise.all([
    supabase
      .from("document_templates")
      .select("id,name,description,category,placeholder_fields,updated_at")
      .order("sort_order")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
  ]);

  if (templates.error) throw new Error(templates.error.message);

  return <TemplateLibrary initial={templates.data || []} canManage={me.data?.role === "admin"} />;
}
