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
  if (!session) {
    redirect("/forgot-password?error=" + encodeURIComponent("Your reset session expired. Request a new link."));
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-users`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "complete-password-reset", password }),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    redirect("/reset-password?error=" + encodeURIComponent(body.error || "Password could not be updated. Please try again."));
  }

  redirect("/login?message=" + encodeURIComponent("Password updated. You can sign in now."));
}
