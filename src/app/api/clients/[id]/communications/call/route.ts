import { getConnectionForFirm, ringCentralError, ringCentralFetch, requireStaffContext } from "@/lib/ringcentral";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireStaffContext();
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { notes?: unknown };
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 10000) : "";
  const { data: client } = await context.supabase.from("clients").select("id, firm_id, phone").eq("id", id).maybeSingle();
  if (!client) return Response.json({ error: "Client not found." }, { status: 404 });
  if (!client.phone) return Response.json({ error: "Add a phone number to the client before calling." }, { status: 400 });
  const connection = await getConnectionForFirm(client.firm_id);
  if (!connection) return Response.json({ error: "RingCentral is not connected." }, { status: 409 });
  if (!connection.from_number) return Response.json({ error: "The connected RingCentral extension has no outbound number." }, { status: 409 });

  const response = await ringCentralFetch(connection, "/restapi/v1.0/account/~/extension/~/ring-out", {
    method: "POST",
    body: JSON.stringify({ from: { phoneNumber: connection.from_number }, to: { phoneNumber: client.phone }, playPrompt: true }),
  });
  if (!response.ok) return Response.json({ error: await ringCentralError(response, "RingCentral could not start the call.") }, { status: 502 });
  const call = await response.json();
  const ringcentralId = call.id ? String(call.id) : null;
  const { data, error } = await context.supabase.from("client_communications").insert({
    firm_id: client.firm_id,
    client_id: client.id,
    channel: "call",
    direction: "outbound",
    status: call.status?.callStatus || "queued",
    from_number: connection.from_number,
    to_number: client.phone,
    notes: notes || null,
    ringcentral_id: ringcentralId,
    ringcentral_session_id: ringcentralId,
    started_at: new Date().toISOString(),
    created_by: context.user.id,
  }).select("*").single();
  return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json(data, { status: 201 });
}
