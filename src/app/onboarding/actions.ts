"use server";

import { redirect } from "next/navigation";
import { validateNewPassword } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/server";

function onboardingError(message: string): never {
  redirect("/onboarding?error=" + encodeURIComponent(message));
}

export async function completeOnboarding(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const validationError = validateNewPassword(password, confirmPassword);

  if (validationError) onboardingError(validationError);

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) onboardingError("Your invitation session has expired. Please request a new invitation.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.status !== "active") {
    await supabase.auth.signOut();
    onboardingError("Your account is not active. Please contact an administrator.");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password,
    data: { ...user.user_metadata, onboarding_completed: true },
  });

  if (updateError) onboardingError(updateError.message);

  await supabase.auth.signOut();
  redirect("/login?message=" + encodeURIComponent("Your account is ready. Sign in with your new password."));
}
