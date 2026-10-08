import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { recordIdSchema } from "@/lib/search";
export default async function Audit({ searchParams }: { searchParams: Promise<{ record?: string }> }) {
  const selected = recordIdSchema.safeParse((await searchParams).record);
  const supabase = await createClient();
  let query = supabase.from("audit_log").select("id,action,table_name,actor_email,created_at").order("created_at", { ascending: false }).limit(100);
  if (selected.success) query = query.eq("id", selected.data);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return <section className="page"><div className="page-head"><div><span className="eyebrow">SECURITY</span><h1>Audit Log</h1><p>Recent changes across the firm workspace.</p></div></div>
    {selected.success && <p><Link href="/audit">View recent audit entries</Link></p>}
    <article className="card">{(data || []).map((entry) => <div className="list-row" key={entry.id}><span><strong>{entry.action} · {entry.table_name}</strong><small>{entry.actor_email || "System"} · {new Date(entry.created_at).toLocaleString()}</small></span></div>)}</article></section>;
}
