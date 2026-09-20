import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAppUrlOrigin } from "@/lib/auth/app-url";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  encryptToken,
  ringCentralError,
  ringCentralFetch,
  ringCentralRedirectUri,
  ringCentralTokenRequest,
  requireStaffContext,
  webhookSecretHash,
  type RingCentralConnection,
} from "@/lib/ringcentral";

export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/settings/integrations/ringcentral", getAppUrlOrigin());
  const context = await requireStaffContext();
  if (!context || context.profile.role !== "admin") return NextResponse.redirect(new URL("/login", getAppUrlOrigin()));
  const expectedState = request.cookies.get("ringcentral_oauth_state")?.value;
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  if (!expectedState || !state || expectedState !== state || !code) {
    settingsUrl.searchParams.set("error", "RingCentral authorization could not be verified.");
    return clearState(NextResponse.redirect(settingsUrl));
  }

  try {
    const tokens = await ringCentralTokenRequest(new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ringCentralRedirectUri(),
    }));
    const temporary = {
      encrypted_access_token: encryptToken(tokens.access_token),
      encrypted_refresh_token: encryptToken(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      refresh_expires_at: tokens.refresh_token_expires_in
        ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString()
        : null,
    };
    const provisional = {
      ...temporary,
      id: "pending",
      firm_id: context.profile.firm_id,
      account_id: "~",
      extension_id: "~",
      extension_name: null,
      from_number: null,
      webhook_subscription_id: null,
      webhook_secret_hash: null,
    } satisfies RingCentralConnection;
    const [extensionResponse, numbersResponse] = await Promise.all([
      ringCentralFetch(provisional, "/restapi/v1.0/account/~/extension/~"),
      ringCentralFetch(provisional, "/restapi/v1.0/account/~/extension/~/phone-number"),
    ]);
    if (!extensionResponse.ok) throw new Error(await ringCentralError(extensionResponse, "Unable to read the RingCentral extension."));
    if (!numbersResponse.ok) throw new Error(await ringCentralError(numbersResponse, "Unable to read RingCentral phone numbers."));
    const extension = await extensionResponse.json();
    const numbers = await numbersResponse.json();
    const fromNumber = numbers.records?.find((item: { features?: string[] }) => item.features?.includes("SmsSender"))?.phoneNumber
      || numbers.records?.find((item: { usageType?: string }) => item.usageType === "DirectNumber")?.phoneNumber
      || null;
    const admin = createAdminClient();
    const { data: connection, error } = await admin.from("ringcentral_connections").upsert({
      firm_id: context.profile.firm_id,
      account_id: String(extension.account?.id || "~"),
      extension_id: String(extension.id),
      extension_name: extension.name || null,
      from_number: fromNumber,
      ...temporary,
      connected_by: context.user.id,
      connected_at: new Date().toISOString(),
    }, { onConflict: "firm_id" }).select("*").single();
    if (error) throw new Error(error.message);

    const secret = randomBytes(32).toString("base64url");
    await admin.from("ringcentral_connections").update({ webhook_secret_hash: webhookSecretHash(secret) }).eq("id", connection.id);
    const webhookUrl = new URL("/api/ringcentral/webhook", getAppUrlOrigin());
    webhookUrl.searchParams.set("connection", connection.id);
    webhookUrl.searchParams.set("secret", secret);
    const subscriptionResponse = await ringCentralFetch(connection as RingCentralConnection, "/restapi/v1.0/subscription", {
      method: "POST",
      body: JSON.stringify({
        eventFilters: [
          "/restapi/v1.0/account/~/extension/~/message-store/instant?type=SMS",
          "/restapi/v1.0/account/~/extension/~/telephony/sessions",
        ],
        deliveryMode: { transportType: "WebHook", address: webhookUrl.toString() },
      }),
    });
    if (subscriptionResponse.ok) {
      const subscription = await subscriptionResponse.json();
      await admin.from("ringcentral_connections").update({
        webhook_subscription_id: subscription.id,
      }).eq("id", connection.id);
    } else {
      settingsUrl.searchParams.set("warning", "Connected, but inbound activity needs the RingCentral webhook enabled.");
    }
    settingsUrl.searchParams.set("connected", "1");
    return clearState(NextResponse.redirect(settingsUrl));
  } catch (error) {
    settingsUrl.searchParams.set("error", error instanceof Error ? error.message : "Unable to connect RingCentral.");
    return clearState(NextResponse.redirect(settingsUrl));
  }
}

function clearState(response: NextResponse) {
  response.cookies.set("ringcentral_oauth_state", "", { maxAge: 0, path: "/" });
  return response;
}
