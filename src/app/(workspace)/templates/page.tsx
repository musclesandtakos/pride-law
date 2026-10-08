import Link from "next/link";
import { recordIdSchema } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import { TemplateLibrary } from "@/components/template-library";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ record?: string }> }) {
  const selected = recordIdSchema.safeParse((await searchParams).record);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let templateQuery = supabase
      .from("document_templates")
      .select("id,name,description,category,subsection,placeholder_fields,updated_at")
      .order("sort_order")
      .order("created_at", { ascending: false });
  if (selected.success) templateQuery = templateQuery.eq("id", selected.data);
  const [templates, clients, me] = await Promise.all([
    templateQuery,
    supabase.from("clients").select("id,name,phone,email").order("name"),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
  ]);

  if (templates.error) throw new Error(templates.error.message);
  if (clients.error) throw new Error(clients.error.message);

  return <>{selected.success && <div className="search-record-context">Search result · <Link href="/templates">View all templates</Link></div>}<TemplateLibrary key={selected.success ? selected.data : "templates"} initial={templates.data || []} clients={clients.data || []} canManage={me.data?.role === "admin"} /></>;
}
