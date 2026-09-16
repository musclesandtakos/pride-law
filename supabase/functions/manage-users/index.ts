import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const roles = new Set(["admin", "attorney", "staff", "billing", "readonly"]);
const json = (body: unknown, status = 200) => Response.json(body, { status });
const profileFields = "id,full_name,email,role,status,created_at,must_change_password,temporary_password_expires_at";

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const random = new Uint32Array(20);
  crypto.getRandomValues(random);
  const required = ["A", "z", "7", "!"];
  const generated = required.concat(Array.from(random, (value) => alphabet[value % alphabet.length]));
  const shuffle = new Uint32Array(generated.length);
  crypto.getRandomValues(shuffle);
  return generated.map((character, index) => ({ character, order: shuffle[index] }))
    .sort((a, b) => a.order - b.order).map(({ character }) => character).join("");
}

Deno.serve(async (req) => {
  if (!["POST", "PATCH"].includes(req.method)) return json({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = authorization.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: "Unauthorized" }, 401);
  const body = await req.json();
  const action = String(body.action || "");
  const { data: actor } = await admin.from("profiles")
    .select("firm_id,role,status,must_change_password,temporary_password_expires_at").eq("id", user.id).single();

  if (req.method === "PATCH" && action === "complete-password-reset") {
    const password = String(body.password || "");
    if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
    if (actor?.must_change_password) {
      const expiresAt = actor.temporary_password_expires_at
        ? new Date(actor.temporary_password_expires_at).getTime()
        : 0;
      if (!expiresAt || expiresAt <= Date.now()) return json({ error: "Temporary password expired" }, 400);
    }
    const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, { password });
    if (passwordError) return json({ error: passwordError.message }, 400);
    const { error } = await admin.from("profiles").update({
      must_change_password: false,
      temporary_password_expires_at: null,
    }).eq("id", user.id);
    return error ? json({ error: error.message }, 400) : json({ ok: true });
  }

  if (!actor || actor.role !== "admin" || actor.status !== "active") return json({ error: "Firm administrator access is required" }, 403);

  if (req.method === "POST") {
    if (!roles.has(body.role)) return json({ error: "Choose a valid role" }, 400);
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email) || !fullName) return json({ error: "Full name and a valid email are required" }, 400);
    const redirectTo = String(body.redirectTo || "");
    if (!/^https?:\/\//.test(redirectTo)) return json({ error: "Invalid invitation redirect" }, 400);
    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, redirectTo });
    if (error || !invited.user) return json({ error: error?.message || "Unable to invite user" }, 400);
    const { data: profile, error: updateError } = await admin.from("profiles").update({
      firm_id: actor.firm_id, full_name: fullName, email, role: body.role, status: "invited"
    }).eq("id", invited.user.id).select(profileFields).single();
    return updateError ? json({ error: updateError.message }, 400) : json(profile, 201);
  }

  const id = String(body.id || "");
  if (!id) return json({ error: "User id is required" }, 400);

  if (action === "issue-temporary-password") {
    const { data: target, error: targetError } = await admin.from("profiles")
      .select("id,status").eq("id", id).eq("firm_id", actor.firm_id).single();
    if (targetError || !target) return json({ error: "User was not found in your firm" }, 404);
    if (target.status !== "active") return json({ error: "Temporary passwords can only be issued to active users" }, 400);

    const password = temporaryPassword();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: flagError } = await admin.from("profiles").update({
      must_change_password: true,
      temporary_password_expires_at: expiresAt,
    }).eq("id", id).eq("firm_id", actor.firm_id);
    if (flagError) return json({ error: flagError.message }, 400);

    const { error: passwordError } = await admin.auth.admin.updateUserById(id, { password });
    if (passwordError) {
      await admin.from("profiles").update({
        must_change_password: false,
        temporary_password_expires_at: null,
      }).eq("id", id).eq("firm_id", actor.firm_id);
      return json({ error: passwordError.message }, 400);
    }

    return json({ temporaryPassword: password, expiresAt });
  }

  if (!roles.has(body.role)) return json({ error: "Choose a valid role" }, 400);
  if (id === user.id && body.role !== "admin") return json({ error: "You cannot remove your own administrator access" }, 400);
  const { data, error } = await admin.from("profiles").update({ role: body.role })
    .eq("id", id).eq("firm_id", actor.firm_id).select(profileFields).single();
  return error ? json({ error: error.message }, 400) : json(data);
});
