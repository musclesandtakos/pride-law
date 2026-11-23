import { createClient } from "@/lib/supabase/server";
import { canSearch, searchColumns, searchFilter, searchRequestSchema, searchResult, SEARCH_PAGE_SIZE, sourcesForRole } from "@/lib/search";

export const dynamic = "force-dynamic";
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.is_anonymous) return json({ error: "Sign in with your staff account to search." }, 401);
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("firm_id,role,status,must_change_password").eq("id", user.id).maybeSingle();
  if (profileError || !canSearch(profile)) return json({ error: "An active staff account is required to search." }, 403);

  const parsed = searchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Enter 2–120 characters and choose a valid search category." }, 400);
  const { q, category, page } = parsed.data;
  const allowed = sourcesForRole(profile!.role);
  if (category !== "all" && !allowed.some((source) => source.key === category)) return json({ error: "This search category is not available to your account." }, 403);
  const selected = allowed.filter((source) => category === "all" || source.key === category);
  const offset = category === "all" ? 0 : page * SEARCH_PAGE_SIZE;
  const searched = await Promise.allSettled(selected.map(async (source) => {
    // Use the staff session and both an explicit firm predicate and the table's existing RLS.
    const { data, error } = await supabase.from(source.table).select(searchColumns(source))
      .eq("firm_id", profile!.firm_id).or(searchFilter(source, q))
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + SEARCH_PAGE_SIZE).returns<Record<string, unknown>[]>().abortSignal(request.signal);
    if (error) throw new Error(source.key);
    return { key: source.key, label: source.label, hasMore: (data?.length || 0) > SEARCH_PAGE_SIZE,
      results: (data || []).slice(0, SEARCH_PAGE_SIZE).map((row) => searchResult(source, row, q)) };
  }));
  const unavailable = searched.flatMap((result, index) => result.status === "rejected" ? [selected[index].label] : []);
  if (unavailable.length === selected.length) return json({ error: "Search is temporarily unavailable. Please try again." }, 503);
  return json({ groups: searched.flatMap((result) => result.status === "fulfilled" ? [result.value] : []),
    categories: allowed.map(({ key, label }) => ({ key, label })), page: category === "all" ? 0 : page,
    partial: unavailable.length > 0, unavailable });
}
