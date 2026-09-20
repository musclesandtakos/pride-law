import { getConnectionForFirm, ringCentralError, ringCentralFetch, requireStaffContext } from "@/lib/ringcentral";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; communicationId: string }> }) {
  const context = await requireStaffContext();
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id, communicationId } = await params;
  const { data: communication } = await context.supabase.from("client_communications")
    .select("firm_id, recording_id").eq("id", communicationId).eq("client_id", id).maybeSingle();
  if (!communication?.recording_id) return Response.json({ error: "No recording is available for this call." }, { status: 404 });
  const connection = await getConnectionForFirm(communication.firm_id);
  if (!connection) return Response.json({ error: "RingCentral is not connected." }, { status: 409 });
  const response = await ringCentralFetch(connection, `/restapi/v1.0/account/~/recording/${encodeURIComponent(communication.recording_id)}/content`, {
    headers: { Accept: "audio/mpeg, audio/wav, application/octet-stream" },
  });
  if (!response.ok) return Response.json({ error: await ringCentralError(response, "The recording is not available yet.") }, { status: response.status === 404 ? 404 : 502 });
  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("content-type") || "audio/mpeg",
      "Content-Disposition": `inline; filename="client-call-${communicationId}.mp3"`,
      "Cache-Control": "private, no-store",
    },
  });
}
