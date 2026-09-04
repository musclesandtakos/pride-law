import { createClient } from "@/lib/supabase/server";
import { TemplateAdmin } from "@/components/template-admin";

export const dynamic = "force-dynamic";

export default async function TemplateAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "admin") {
    return (
      <section className="page">
        <div className="card access-card">
          <h1>Administrator access required</h1>
          <p>Only firm administrators can upload, delete, or organize document templates.</p>
        </div>
      </section>
    );
  }

  const templates = await supabase
    .from("document_templates")
    .select("id,name,description,category,placeholder_fields,sort_order,created_at,updated_at")
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (templates.error) throw new Error(templates.error.message);

  return <TemplateAdmin initial={templates.data || []} />;
}
