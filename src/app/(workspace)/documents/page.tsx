import Link from "next/link";
import { recordIdSchema } from "@/lib/search";
import { DocumentsModule } from "@/components/documents-module";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ record?: string }> }) {
  const selected = recordIdSchema.safeParse((await searchParams).record);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  let documentsQuery = supabase.from("documents").select("id,name,storage_path,document_type,status,owner_name,client_id,matter_id,file_size,created_at").order("created_at", { ascending: false });
  if (selected.success) documentsQuery = documentsQuery.eq("id", selected.data);
  const [profile, documents, clients, matters] = await Promise.all([
    supabase.from("profiles").select("id,firm_id,full_name").eq("id", user.id).single(),
    documentsQuery,
    supabase.from("clients").select("id,name").order("name"),
    supabase.from("matters").select("id,name").order("name"),
  ]);
  if (!profile.data?.firm_id) return null;
  if (documents.error) throw new Error(documents.error.message);
  return <>{selected.success && <div className="search-record-context">Search result · <Link href="/documents">View all documents</Link></div>}<DocumentsModule key={selected.success ? selected.data : "documents"} initial={documents.data || []} clients={clients.data || []} matters={matters.data || []}
    firmId={profile.data.firm_id} profileId={profile.data.id} ownerName={profile.data.full_name || "Pride Law staff"}/></>;
}
