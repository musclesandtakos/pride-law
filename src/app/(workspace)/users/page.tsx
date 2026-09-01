import { createClient } from "@/lib/supabase/server";
import { UsersModule } from "@/components/users-module";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "admin") return <section className="page"><div className="card access-card"><h1>Administrator access required</h1><p>Only firm administrators can invite members or change roles.</p></div></section>;
  const { data: users, error } = await supabase.from("profiles")
    .select("id,full_name,email,role,status,created_at").order("created_at");
  if (error) throw new Error(error.message);
  return <UsersModule initial={users || []} currentUserId={user!.id} />;
}
