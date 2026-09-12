import { NextResponse } from "next/server";
import { resolveCallbackFlow, parseEmailOtpType } from "@/lib/auth/callback-flow";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

function redirectToLogin(url: URL, message: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, url.origin));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = parseEmailOtpType(url.searchParams.get("type"));
  const callbackFlow = resolveCallbackFlow({ flow: url.searchParams.get("flow"), type });
  const next = callbackFlow === "recovery" ? "/reset-password" : safeNextPath(url.searchParams.get("next"));
  const supabase = await createClient();

  let userId: string | undefined;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirectToLogin(url, error.message);
    userId = data.user?.id;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return redirectToLogin(url, error.message);
    userId = data.user?.id;
  } else {
    return redirectToLogin(url, "Invalid or incomplete authentication callback.");
  }

  if (!userId) {
    await supabase.auth.signOut();
    return redirectToLogin(url, "Unable to establish a valid session.");
  }

  const { data: profile } = await supabase.from("profiles").select("status").eq("id", userId).maybeSingle();

  if (profile?.status !== "active") {
    await supabase.auth.signOut();

    if (!profile) return redirectToLogin(url, "Your account profile could not be found.");
    if (profile.status === "invited") return redirectToLogin(url, "Please confirm your invitation before signing in.");
    if (profile.status === "disabled") return redirectToLogin(url, "Your account has been disabled.");

    return redirectToLogin(url, "Your account is not active.");
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
