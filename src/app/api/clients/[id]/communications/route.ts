import { requireStaffContext } from "@/lib/ringcentral";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireStaffContext();
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { notes?: unknown; summary?: unknown } | null;
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 10000) : "";
  const summary = typeof body?.summary === "string" ? body.summary.trim().slice(0, 10000) : "";
  if (!notes && !summary) return Response.json({ error: "Enter a note or summary." }, { status: 400 });
  const { data: client } = await context.supabase.from("clients").select("id, firm_id").eq("id", id).maybeSingle();
  if (!client) return Response.json({ error: "Client not found." }, { status: 404 });
  const { data, error } = await context.supabase.from("client_communications").insert({
    firm_id: client.firm_id,
    client_id: client.id,
    channel: "note",
    direction: "internal",
    status: "logged",
    notes: notes || null,
    summary: summary || null,
    created_by: context.user.id,
  }).select("*").single();
  return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json(data, { status: 201 });
}
