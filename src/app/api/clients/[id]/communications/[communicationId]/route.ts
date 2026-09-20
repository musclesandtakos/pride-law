import { requireStaffContext } from "@/lib/ringcentral";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; communicationId: string }> }) {
  const context = await requireStaffContext();
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id, communicationId } = await params;
  const body = await request.json().catch(() => null) as { notes?: unknown; summary?: unknown } | null;
  const changes: { notes?: string | null; summary?: string | null } = {};
  if (typeof body?.notes === "string") changes.notes = body.notes.trim().slice(0, 10000) || null;
  if (typeof body?.summary === "string") changes.summary = body.summary.trim().slice(0, 10000) || null;
  if (!Object.keys(changes).length) return Response.json({ error: "No changes supplied." }, { status: 400 });
  const { data, error } = await context.supabase.from("client_communications").update(changes)
    .eq("id", communicationId).eq("client_id", id).select("*").maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return data ? Response.json(data) : Response.json({ error: "Communication not found." }, { status: 404 });
}
