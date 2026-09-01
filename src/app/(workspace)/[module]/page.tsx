import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataModule } from "@/components/data-module";
import { resources, type ResourceKey } from "@/lib/resources";
export const dynamic="force-dynamic";
export default async function ModulePage({params}:{params:Promise<{module:string}>}){const {module}=await params;if(!(module in resources))notFound();const r=resources[module as ResourceKey];const s=await createClient();const {data,error}=await s.from(r.table).select("*").order("created_at",{ascending:false});if(error)throw new Error(error.message);return <DataModule title={r.title} resource={module} columns={r.columns} labels={r.labels} initial={data||[]}/>} 
