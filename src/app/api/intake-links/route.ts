import { getAppUrlOrigin } from "@/lib/auth/app-url";
import { createIntakeLinkSchema, generateIntakeToken, hashIntakeToken } from "@/lib/client-intake";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createIntakeLinkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Please complete every required field." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("firm_id,status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.firm_id || profile.status !== "active") {
    return Response.json({ error: "Your account is not active." }, { status: 403 });
  }

  const token = generateIntakeToken();
  const tokenHash = await hashIntakeToken(token);
  const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("client_intake_links")
    .insert({
      firm_id: profile.firm_id,
      token_hash: tokenHash,
      recipient_name: parsed.data.recipientName,
      recipient_email: parsed.data.recipientEmail,
      practice_area: parsed.data.practiceArea,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select("id,recipient_name,recipient_email,practice_area,expires_at,submitted_at,revoked_at,created_at")
    .single();

  if (error) return Response.json({ error: "Unable to create the intake link." }, { status: 400 });

  return Response.json(
    { ...data, url: `${getAppUrlOrigin()}/intake/${token}` },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}

