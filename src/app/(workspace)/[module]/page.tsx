import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataModule } from "@/components/data-module";
import { formFieldsFor, resources, type ResourceKey } from "@/lib/resources";
import { recordIdSchema } from "@/lib/search";

export const dynamic = "force-dynamic";
export default async function ModulePage({ params, searchParams }: {
  params: Promise<{ module: string }>; searchParams: Promise<{ record?: string }>;
}) {
  const { module } = await params;
  if (!(module in resources)) notFound();
  const key = module as ResourceKey, resource = resources[key];
  const record = recordIdSchema.safeParse((await searchParams).record);
  const supabase = await createClient();
  let query = supabase.from(resource.table).select("*").order("created_at", { ascending: false });
  if (record.success) query = query.eq("id", record.data);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const singular = "singular" in resource ? resource.singular : resource.title.replace(/s$/i, "");
  return <>{record.success && <div className="search-record-context">Search result · <Link href={`/${module}`}>View all {resource.title.toLowerCase()}</Link></div>}
    <DataModule key={record.success ? record.data : module} title={resource.title} singular={singular} resource={module}
      columns={resource.columns} labels={resource.labels} fields={formFieldsFor(key)} initial={data || []}/></>;
}
