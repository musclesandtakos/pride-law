import Link from "next/link";
import { recordIdSchema } from "@/lib/search";
import { IntakeLinksModule } from "@/components/intake-links-module";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function IntakeLinksPage({ searchParams }: { searchParams: Promise<{ record?: string }> }) {
  const selected = recordIdSchema.safeParse((await searchParams).record);
  const supabase = await createClient();
  let linkQuery = supabase
    .from("client_intake_links")
    .select("id,recipient_name,recipient_email,practice_area,expires_at,submitted_at,revoked_at,created_at")
    .order("created_at", { ascending: false });

  if (selected.success) linkQuery = linkQuery.eq("id", selected.data);
  const { data, error } = await linkQuery;
  if (error) throw new Error(error.message);
  return <>{selected.success && <div className="search-record-context">Search result · <Link href="/intake-links">View all intake links</Link></div>}<IntakeLinksModule key={selected.success ? selected.data : "intake-links"} initial={data || []}/></>;
}

