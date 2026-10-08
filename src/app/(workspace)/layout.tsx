import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlobalSearch } from "@/components/global-search";
import { canSearch } from "@/lib/search";
import { Sidebar } from "@/components/sidebar";
export const dynamic="force-dynamic";
export default async function WorkspaceLayout({children}:{children:React.ReactNode}){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user || user.is_anonymous)redirect("/login");
 const {data:profile}=await supabase.from("profiles").select("full_name,firm_id,role,status,must_change_password").eq("id",user.id).maybeSingle();
 if (profile?.must_change_password) redirect("/reset-password");
 if (!canSearch(profile)) redirect("/login?error=An%20active%20staff%20account%20is%20required");
 return <div className="app-shell"><Sidebar name={profile?.full_name||user.email?.split("@")[0]||"Team Member"} email={user.email||""}/><main className="content"><header className="topbar"><div><span className="eyebrow">PRIDE LAW</span><strong>Legal Practice Management</strong></div><GlobalSearch/><span className="secure">● SECURE WORKSPACE</span></header>{children}</main></div>
}
