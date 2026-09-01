import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const roles = new Set(["admin", "attorney", "staff", "billing", "readonly"]);
const json = (body: unknown, status = 200) => Response.json(body, { status });

Deno.serve(async (req) => {
  if (!["POST", "PATCH"].includes(req.method)) return json({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = authorization.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: "Unauthorized" }, 401);
  const { data: actor } = await admin.from("profiles").select("firm_id,role,status").eq("id", user.id).single();
  if (!actor || actor.role !== "admin" || actor.status !== "active") return json({ error: "Firm administrator access is required" }, 403);
  const body = await req.json();
  if (!roles.has(body.role)) return json({ error: "Choose a valid role" }, 400);

  if (req.method === "POST") {
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email) || !fullName) return json({ error: "Full name and a valid email are required" }, 400);
    const redirectTo = String(body.redirectTo || "");
    if (!/^https?:\/\//.test(redirectTo)) return json({ error: "Invalid invitation redirect" }, 400);
    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, redirectTo });
    if (error || !invited.user) return json({ error: error?.message || "Unable to invite user" }, 400);
    const { data: profile, error: updateError } = await admin.from("profiles").update({
      firm_id: actor.firm_id, full_name: fullName, email, role: body.role, status: "invited"
    }).eq("id", invited.user.id).select("id,full_name,email,role,status,created_at").single();
    return updateError ? json({ error: updateError.message }, 400) : json(profile, 201);
  }

  const id = String(body.id || "");
  if (!id) return json({ error: "User id is required" }, 400);
  if (id === user.id && body.role !== "admin") return json({ error: "You cannot remove your own administrator access" }, 400);
  const { data, error } = await admin.from("profiles").update({ role: body.role })
    .eq("id", id).eq("firm_id", actor.firm_id).select("id,full_name,email,role,status,created_at").single();
  return error ? json({ error: error.message }, 400) : json(data);
});
