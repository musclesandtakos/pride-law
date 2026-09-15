import { IntakeLinksModule } from "@/components/intake-links-module";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function IntakeLinksPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_intake_links")
    .select("id,recipient_name,recipient_email,practice_area,expires_at,submitted_at,revoked_at,created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return <IntakeLinksModule initial={data || []}/>;
}

