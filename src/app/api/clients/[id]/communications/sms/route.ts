import { getConnectionForFirm, ringCentralError, ringCentralFetch, requireStaffContext } from "@/lib/ringcentral";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireStaffContext();
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 1000) return Response.json({ error: "Enter a message up to 1,000 characters." }, { status: 400 });
  const { data: client } = await context.supabase.from("clients").select("id, firm_id, phone").eq("id", id).maybeSingle();
  if (!client) return Response.json({ error: "Client not found." }, { status: 404 });
  if (!client.phone) return Response.json({ error: "Add a phone number to the client before sending a text." }, { status: 400 });
  const connection = await getConnectionForFirm(client.firm_id);
  if (!connection) return Response.json({ error: "RingCentral is not connected." }, { status: 409 });
  if (!connection.from_number) return Response.json({ error: "The connected RingCentral extension has no SMS-enabled number." }, { status: 409 });

  const response = await ringCentralFetch(connection, "/restapi/v1.0/account/~/extension/~/sms", {
    method: "POST",
    body: JSON.stringify({ from: { phoneNumber: connection.from_number }, to: [{ phoneNumber: client.phone }], text: message }),
  });
  if (!response.ok) return Response.json({ error: await ringCentralError(response, "RingCentral could not send the text message.") }, { status: 502 });
  const sent = await response.json();
  const { data, error } = await context.supabase.from("client_communications").upsert({
    firm_id: client.firm_id,
    client_id: client.id,
    channel: "sms",
    direction: "outbound",
    status: sent.messageStatus || "queued",
    from_number: connection.from_number,
    to_number: client.phone,
    subject: message,
    ringcentral_id: String(sent.id),
    started_at: sent.creationTime || new Date().toISOString(),
    created_by: context.user.id,
  }, { onConflict: "firm_id,ringcentral_id" }).select("*").single();
  return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json(data, { status: 201 });
}
