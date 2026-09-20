import { notFound } from "next/navigation";
import { ClientCommunications } from "@/components/client-communications";
import { getConnectionForFirm, ringCentralConfigured } from "@/lib/ringcentral";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClientCommunicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, firm_id, name, email, phone, preferred_contact, status").eq("id", id).maybeSingle();
  if (!client) notFound();
  const { data: communications, error } = await supabase.from("client_communications").select("*")
    .eq("client_id", id).order("started_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  const connection = ringCentralConfigured() ? await getConnectionForFirm(client.firm_id) : null;
  return <ClientCommunications
    client={client}
    initialCommunications={communications || []}
    ringCentral={{ configured: ringCentralConfigured(), connected: Boolean(connection), fromNumber: connection?.from_number || null }}
  />;
}
