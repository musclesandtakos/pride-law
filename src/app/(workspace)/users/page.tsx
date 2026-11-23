import Link from "next/link";
import { recordIdSchema } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import { UsersModule } from "@/components/users-module";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ record?: string }> }) {
  const selected = recordIdSchema.safeParse((await searchParams).record);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "admin") return <section className="page"><div className="card access-card"><h1>Administrator access required</h1><p>Only firm administrators can invite members or change roles.</p></div></section>;
  let query = supabase.from("profiles")
    .select("id,full_name,email,role,status,created_at,must_change_password,temporary_password_expires_at").order("created_at");
  if (selected.success) query = query.eq("id", selected.data);
  const { data: users, error } = await query;
  if (error) throw new Error(error.message);
  return <>{selected.success && <div className="search-record-context">Search result · <Link href="/users">View all staff</Link></div>}<UsersModule key={selected.success ? selected.data : "users"} initial={users || []} currentUserId={user!.id} /></>;
}
