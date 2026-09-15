import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { practiceAreas } from "@/lib/intake-fields";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));

export const createIntakeLinkSchema = z.object({
  recipientName: z.string().trim().min(2).max(160),
  recipientEmail: z.string().trim().email().max(254),
  practiceArea: z.enum(practiceAreas),
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

export const publicIntakeSchema = z.object({
  company: z.string().max(0).optional().or(z.literal("")),
  legalName: z.string().trim().min(2).max(200),
  preferredName: optionalText(200),
  pronouns: optionalText(80),
  dateOfBirth: optionalDate,
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(40),
  addressLine1: optionalText(240),
  addressLine2: optionalText(240),
  city: optionalText(120),
  state: optionalText(80),
  postalCode: optionalText(24),
  preferredContact: z.enum(["Email", "Phone", "Text"]),
  practiceArea: z.enum(practiceAreas),
  incidentDate: optionalDate,
  incidentLocation: optionalText(500),
  opposingParties: optionalText(2000),
  matterSummary: z.string().trim().min(20).max(10000),
  injuriesOrDamages: optionalText(5000),
  insuranceInformation: optionalText(3000),
  referralSource: optionalText(500),
  consentToContact: z.literal(true),
  signatureName: z.string().trim().min(2).max(200),
});

export type PublicIntakeLink = {
  id: string;
  firm_id: string;
  recipient_name: string;
  recipient_email: string;
  practice_area: string | null;
  expires_at: string;
};

export function generateIntakeToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashIntakeToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getPublicIntakeLink(token: string): Promise<PublicIntakeLink | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const tokenHash = await hashIntakeToken(token);
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-intake-token": tokenHash } },
    },
  );

  const { data, error } = await supabase
    .from("client_intake_links")
    .select("id,firm_id,recipient_name,recipient_email,practice_area,expires_at")
    .maybeSingle();

  if (error || !data) return null;
  return data as PublicIntakeLink;
}

export function publicIntakeClientForHash(tokenHash: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-intake-token": tokenHash } },
    },
  );
}
