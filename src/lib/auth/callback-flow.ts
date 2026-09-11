import type { EmailOtpType } from "@supabase/supabase-js";

const OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const satisfies readonly EmailOtpType[];

type CallbackFlow = "invite" | "recovery" | "other";

export function parseEmailOtpType(type: string | null): EmailOtpType | null {
  if (!type) return null;
  return (OTP_TYPES as readonly string[]).includes(type) ? (type as EmailOtpType) : null;
}

export function resolveCallbackFlow(input: { flow: string | null; type: EmailOtpType | null }) {
  if (input.flow === "recovery" || input.type === "recovery") return "recovery" as CallbackFlow;
  if (input.flow === "invite" || input.type === "invite") return "invite" as CallbackFlow;
  return "other" as CallbackFlow;
}
