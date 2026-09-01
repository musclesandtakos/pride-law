import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
export const dynamic="force-dynamic";
export default async function WorkspaceLayout({children}:{children:React.ReactNode}){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:profile}=await supabase.from("profiles").select("full_name").eq("id",user.id).maybeSingle();
 return <div className="app-shell"><Sidebar name={profile?.full_name||user.email?.split("@")[0]||"Team Member"} email={user.email||""}/><main className="content"><header className="topbar"><div><span className="eyebrow">PRIDE LAW</span><strong>Legal Practice Management</strong></div><span className="secure">● SECURE WORKSPACE</span></header>{children}</main></div>
}
