"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email")||""), password = String(formData.get("password")||"");
  const { error } = await supabase.auth.signInWithPassword({email,password});
  if (error) redirect("/login?error="+encodeURIComponent(error.message));
  redirect("/");
}
export async function signOut(){const supabase=await createClient();await supabase.auth.signOut();redirect("/login");}
