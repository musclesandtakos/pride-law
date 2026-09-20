import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ringCentralConfigured, ringCentralRedirectUri, ringCentralServer, requireStaffContext } from "@/lib/ringcentral";

export async function GET() {
  const context = await requireStaffContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (context.profile.role !== "admin") return NextResponse.json({ error: "Only an administrator can connect RingCentral." }, { status: 403 });
  if (!ringCentralConfigured()) return NextResponse.json({ error: "RingCentral credentials are not configured." }, { status: 503 });

  const state = randomBytes(32).toString("base64url");
  const authorize = new URL(`${ringCentralServer()}/restapi/oauth/authorize`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", ringCentralRedirectUri());
  authorize.searchParams.set("client_id", process.env.RINGCENTRAL_CLIENT_ID!);
  authorize.searchParams.set("state", state);

  const response = NextResponse.redirect(authorize);
  response.cookies.set("ringcentral_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return response;
}
