import { createAdminClient } from "@/lib/supabase/admin";
import { getConnectionForFirm, ringCentralConfigured, ringCentralError, ringCentralFetch, requireStaffContext } from "@/lib/ringcentral";

export async function GET() {
  const context = await requireStaffContext();
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const connection = ringCentralConfigured() ? await getConnectionForFirm(context.profile.firm_id) : null;
  return Response.json({
    configured: ringCentralConfigured(),
    connected: Boolean(connection),
    isAdmin: context.profile.role === "admin",
    extensionName: connection?.extension_name || null,
    fromNumber: connection?.from_number || null,
    inboundEnabled: Boolean(connection?.webhook_subscription_id),
  });
}

export async function DELETE() {
  const context = await requireStaffContext();
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (context.profile.role !== "admin") return Response.json({ error: "Only an administrator can disconnect RingCentral." }, { status: 403 });
  const connection = await getConnectionForFirm(context.profile.firm_id);
  if (!connection) return Response.json({ ok: true });
  if (connection.webhook_subscription_id) {
    const response = await ringCentralFetch(connection, `/restapi/v1.0/subscription/${encodeURIComponent(connection.webhook_subscription_id)}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) return Response.json({ error: await ringCentralError(response, "Unable to remove the RingCentral webhook.") }, { status: 502 });
  }
  const admin = createAdminClient();
  const { error } = await admin.from("ringcentral_connections").delete().eq("id", connection.id);
  return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ ok: true });
}
