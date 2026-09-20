import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, ringCentralFetch, verifyWebhookSecret, type RingCentralConnection } from "@/lib/ringcentral";

type WebhookEvent = { event?: string; body?: Record<string, unknown> };

export async function POST(request: NextRequest) {
  const validationToken = request.headers.get("validation-token");
  const connectionId = request.nextUrl.searchParams.get("connection");
  const secret = request.nextUrl.searchParams.get("secret") || "";
  if (!connectionId) return Response.json({ error: "Missing connection." }, { status: 400 });
  const admin = createAdminClient();
  const { data } = await admin.from("ringcentral_connections").select("*").eq("id", connectionId).maybeSingle();
  const connection = data as RingCentralConnection | null;
  if (!connection || !verifyWebhookSecret(secret, connection.webhook_secret_hash)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  if (validationToken) return new Response(null, { status: 200, headers: { "Validation-Token": validationToken } });
  const events = await request.json().catch(() => []) as WebhookEvent[] | WebhookEvent;
  for (const event of Array.isArray(events) ? events : [events]) {
    try {
      if (event.event?.includes("message-store")) await captureMessage(connection, event, admin);
      if (event.event?.includes("telephony/sessions")) await captureCall(connection, event, admin);
    } catch (error) {
      console.error("RingCentral webhook event failed", error);
    }
  }
  return new Response(null, { status: 200 });
}

async function findClient(admin: ReturnType<typeof createAdminClient>, firmId: string, phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const { data } = await admin.from("clients").select("id, phone").eq("firm_id", firmId).not("phone", "is", null);
  return data?.find((client) => normalizePhone(client.phone) === normalized) || null;
}

async function captureMessage(connection: RingCentralConnection, event: WebhookEvent, admin: ReturnType<typeof createAdminClient>) {
  const body = event.body || {};
  const messageId = body.id ? String(body.id) : event.event?.match(/message-store\/(\d+)/)?.[1];
  if (!messageId) return;
  const response = await ringCentralFetch(connection, `/restapi/v1.0/account/~/extension/~/message-store/${encodeURIComponent(messageId)}`);
  if (!response.ok) return;
  const message = await response.json();
  const direction = String(message.direction || "Inbound").toLowerCase() === "outbound" ? "outbound" : "inbound";
  const clientPhone = direction === "inbound" ? message.from?.phoneNumber : message.to?.[0]?.phoneNumber;
  const client = await findClient(admin, connection.firm_id, clientPhone);
  if (!client) return;
  await admin.from("client_communications").upsert({
    firm_id: connection.firm_id,
    client_id: client.id,
    channel: "sms",
    direction,
    status: message.messageStatus || "received",
    from_number: message.from?.phoneNumber || null,
    to_number: message.to?.[0]?.phoneNumber || null,
    subject: message.subject || null,
    ringcentral_id: String(message.id),
    started_at: message.creationTime || new Date().toISOString(),
  }, { onConflict: "firm_id,ringcentral_id" });
}

async function captureCall(connection: RingCentralConnection, event: WebhookEvent, admin: ReturnType<typeof createAdminClient>) {
  const body = event.body || {};
  const parties = Array.isArray(body.parties) ? body.parties as Array<Record<string, unknown>> : [];
  const party = parties.find((item) => item.direction === "Inbound" || item.direction === "Outbound") || parties[0];
  if (!party) return;
  const direction = String(party.direction || "Inbound").toLowerCase() === "outbound" ? "outbound" : "inbound";
  const from = (party.from as { phoneNumber?: string } | undefined)?.phoneNumber || null;
  const to = (party.to as { phoneNumber?: string } | undefined)?.phoneNumber || null;
  const client = await findClient(admin, connection.firm_id, direction === "inbound" ? from || "" : to || "");
  if (!client) return;
  const sessionId = String(body.telephonySessionId || body.sessionId || "");
  if (!sessionId) return;
  const status = String((party.status as { code?: string } | undefined)?.code || "active");
  const recording = party.recording as { id?: string; active?: boolean } | undefined;
  const { data: existing } = await admin.from("client_communications").select("id").eq("firm_id", connection.firm_id)
    .eq("ringcentral_session_id", sessionId).maybeSingle();
  const values = {
    firm_id: connection.firm_id,
    client_id: client.id,
    channel: "call",
    direction,
    status,
    from_number: from,
    to_number: to,
    ringcentral_session_id: sessionId,
    recording_id: recording?.id ? String(recording.id) : null,
    recording_available: Boolean(recording?.id),
    ended_at: /disconnected|gone|finished/i.test(status) ? new Date().toISOString() : null,
  };
  if (existing) await admin.from("client_communications").update(values).eq("id", existing.id);
  else await admin.from("client_communications").insert({ ...values, started_at: new Date().toISOString() });
}
