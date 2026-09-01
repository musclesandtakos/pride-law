import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

async function invoke(request: Request, method: "POST" | "PATCH") {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (method === "POST") body.redirectTo = new URL("/auth/callback", request.url).toString();
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-users`, {
    method,
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return new Response(await response.text(), { status: response.status, headers: { "Content-Type": "application/json" } });
}

export async function POST(request: Request) { return invoke(request, "POST"); }
export async function PATCH(request: Request) { return invoke(request, "PATCH"); }
