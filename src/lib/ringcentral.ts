import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrlOrigin } from "@/lib/auth/app-url";
import { decryptToken, encryptToken } from "@/lib/ringcentral-utils";
export { decryptToken, encryptToken, normalizePhone, verifyWebhookSecret, webhookSecretHash } from "@/lib/ringcentral-utils";

const DEFAULT_SERVER = "https://platform.ringcentral.com";

export type RingCentralConnection = {
  id: string;
  firm_id: string;
  account_id: string;
  extension_id: string;
  extension_name: string | null;
  from_number: string | null;
  encrypted_access_token: string;
  encrypted_refresh_token: string;
  token_expires_at: string;
  refresh_expires_at: string | null;
  webhook_subscription_id: string | null;
  webhook_secret_hash: string | null;
};

export function ringCentralConfigured() {
  return Boolean(
    process.env.RINGCENTRAL_CLIENT_ID &&
    process.env.RINGCENTRAL_CLIENT_SECRET &&
    process.env.RINGCENTRAL_TOKEN_ENCRYPTION_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function ringCentralServer() {
  return (process.env.RINGCENTRAL_SERVER_URL || DEFAULT_SERVER).replace(/\/$/, "");
}

export function ringCentralRedirectUri() {
  return `${getAppUrlOrigin()}/api/ringcentral/callback`;
}

export async function ringCentralTokenRequest(params: URLSearchParams) {
  const clientId = process.env.RINGCENTRAL_CLIENT_ID;
  const clientSecret = process.env.RINGCENTRAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("RingCentral OAuth credentials are not configured.");
  const response = await fetch(`${ringCentralServer()}/restapi/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error_description || body.message || "RingCentral authorization failed.");
  return body as { access_token: string; refresh_token: string; expires_in: number; refresh_token_expires_in?: number };
}

export async function getConnectionForFirm(firmId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("ringcentral_connections").select("*").eq("firm_id", firmId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as RingCentralConnection | null;
}

export async function getValidAccessToken(connection: RingCentralConnection) {
  if (new Date(connection.token_expires_at).getTime() > Date.now() + 60_000) {
    return decryptToken(connection.encrypted_access_token);
  }
  const tokens = await ringCentralTokenRequest(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: decryptToken(connection.encrypted_refresh_token),
  }));
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const refreshExpiresAt = tokens.refresh_token_expires_in
    ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString()
    : connection.refresh_expires_at;
  const admin = createAdminClient();
  const { error } = await admin.from("ringcentral_connections").update({
    encrypted_access_token: encryptToken(tokens.access_token),
    encrypted_refresh_token: encryptToken(tokens.refresh_token),
    token_expires_at: tokenExpiresAt,
    refresh_expires_at: refreshExpiresAt,
  }).eq("id", connection.id);
  if (error) throw new Error(error.message);
  return tokens.access_token;
}

export async function ringCentralFetch(
  connection: RingCentralConnection,
  path: string,
  init: RequestInit = {},
) {
  const token = await getValidAccessToken(connection);
  return fetch(`${ringCentralServer()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
}

export async function requireStaffContext() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("firm_id, role, full_name").eq("id", user.id).maybeSingle();
  if (!profile?.firm_id) return null;
  return { supabase, user, profile };
}

export async function ringCentralError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return body.message || body.error_description || fallback;
}
