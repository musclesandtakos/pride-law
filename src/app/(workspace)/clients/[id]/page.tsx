import Link from "next/link";
import { recordIdSchema } from "@/lib/search";
import { notFound } from "next/navigation";
import { ClientCommunications } from "@/components/client-communications";
import { getConnectionForFirm, ringCentralConfigured } from "@/lib/ringcentral";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClientCommunicationsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ communication?: string }> }) {
  const { id } = await params;
  const selected = recordIdSchema.safeParse((await searchParams).communication);
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, firm_id, name, email, phone, preferred_contact, status").eq("id", id).maybeSingle();
  if (!client) notFound();
  let query = supabase.from("client_communications").select("*")
    .eq("client_id", id).order("started_at", { ascending: false }).limit(100);
  if (selected.success) query = query.eq("id", selected.data);
  const { data: communications, error } = await query;
  if (error) throw new Error(error.message);
  const connection = ringCentralConfigured() ? await getConnectionForFirm(client.firm_id) : null;
  return <>{selected.success && <div className="search-record-context">Search result · <Link href={`/clients/${id}`}>View recent communications</Link></div>}<ClientCommunications key={selected.success ? selected.data : id}
    client={client}
    initialCommunications={communications || []}
    ringCentral={{ configured: ringCentralConfigured(), connected: Boolean(connection), fromNumber: connection?.from_number || null }}
  /></>;
}
