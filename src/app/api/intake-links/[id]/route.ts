import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return Response.json({ error: "Invalid link." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("client_intake_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("submitted_at", null)
    .select("id,recipient_name,recipient_email,practice_area,expires_at,submitted_at,revoked_at,created_at")
    .maybeSingle();

  if (error || !data) return Response.json({ error: "This link cannot be revoked." }, { status: 400 });
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}

