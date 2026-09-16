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
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect("/reset-password?error=" + encodeURIComponent(error.message));
  }

  if (session) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-users`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "complete-password-reset" }),
      cache: "no-store",
    });
    if (!response.ok) {
      redirect("/reset-password?error=" + encodeURIComponent("Password changed, but account reset could not be completed. Please try again."));
    }
  }

  redirect("/login?message=" + encodeURIComponent("Password updated. You can sign in now."));
}
