import { createClient } from "@/lib/supabase/server";
import { canSearch } from "@/lib/search";
export function formJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function formContext(write = false, admin = false) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous)
    return {
      error: formJson({ error: "Sign in with your staff account." }, 401),
    };
  const { data: profile } = await supabase
    .from("profiles")
    .select("firm_id,role,status,must_change_password")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !canSearch(profile) ||
    (write && !["admin", "attorney", "staff"].includes(profile!.role)) ||
    (admin && profile!.role !== "admin")
  )
    return {
      error: formJson(
        { error: "Your staff role cannot perform this action." },
        403,
      ),
    };
  return { supabase, user, profile: profile! };
}
