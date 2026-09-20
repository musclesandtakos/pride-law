import {notFound,redirect} from "next/navigation";
import {TemplatePreparation} from "@/components/template-preparation";
import {createClient} from "@/lib/supabase/server";
import {buildIntakePlaceholders,parseTemplateSelection} from "@/lib/template-workflow";
export const dynamic="force-dynamic";
export default async function PrepareTemplatesPage({searchParams}:{searchParams:Promise<{client?:string;forms?:string}>}){
 const {client:clientId,forms}=await searchParams; const templateIds=parseTemplateSelection(forms); if(!clientId||!templateIds.length)redirect("/templates");
 const supabase=await createClient();
 const [client,templates]=await Promise.all([
  supabase.from("clients").select("id,name,phone,email").eq("id",clientId).maybeSingle(),
  supabase.from("document_templates").select("id,name,description,category,subsection,placeholder_fields,storage_path").in("id",templateIds)
 ]);
 if(client.error)throw new Error(client.error.message); if(templates.error)throw new Error(templates.error.message); if(!client.data)notFound();
 const response=await supabase.from("client_intake_responses").select("*").or(`email.eq.${client.data.email||"__none__"},phone.eq.${client.data.phone||"__none__"}`).order("submitted_at",{ascending:false}).limit(1).maybeSingle();
 const placeholders=buildIntakePlaceholders(client.data,response.data as Record<string,unknown>|null);
 const byId=new Map((templates.data||[]).map(template=>[template.id,template])); const ordered=templateIds.flatMap(id=>{const template=byId.get(id);return template?[template]:[]});
 const preparedTemplates=await Promise.all(ordered.map(async template=>{const signed=await supabase.storage.from("document-templates").createSignedUrl(template.storage_path,3600);return{id:template.id,name:template.name,description:template.description,category:template.category,subsection:template.subsection,placeholder_fields:template.placeholder_fields,downloadUrl:signed.data?.signedUrl||null}}));
 return <TemplatePreparation client={client.data} templates={preparedTemplates} initialPlaceholders={placeholders}/>;
}