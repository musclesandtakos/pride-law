"use server";

import { redirect } from "next/navigation";
import { validateNewPassword } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  const validationError = validateNewPassword(password, confirmPassword);
  if (validationError) redirect("/reset-password?error=" + encodeURIComponent(validationError));

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect("/reset-password?error=" + encodeURIComponent(error.message));
  }

  redirect("/login?message=" + encodeURIComponent("Password updated. You can sign in now."));
}
