import {notFound,redirect} from "next/navigation";
import {TemplatePreparation} from "@/components/template-preparation";
import {formContext} from "@/lib/form-auth";
import {parseTemplateSelection} from "@/lib/template-workflow";
export const dynamic="force-dynamic";
export default async function PrepareTemplatesPage({searchParams}:{searchParams:Promise<{client?:string;forms?:string}>}){
 const {client:clientId,forms}=await searchParams;const templateIds=parseTemplateSelection(forms);if(!clientId)redirect("/templates");
 const c=await formContext();if(c.error)redirect("/login");const supabase=c.supabase!;const firm=c.profile!.firm_id;
 const [client,templates,matters,intakes,saved]=await Promise.all([
  supabase.from("clients").select("id,name").eq("firm_id",firm).eq("id",clientId).maybeSingle(),
  templateIds.length?supabase.from("document_templates").select("id,name,description,category,review_status").eq("firm_id",firm).in("id",templateIds):Promise.resolve({data:[],error:null}),
  supabase.from("matters").select("id,name,matter_number").eq("firm_id",firm).eq("client_id",clientId).order("created_at",{ascending:false}),
  supabase.from("client_intake_responses").select("id,legal_name,email,submitted_at").eq("firm_id",firm).order("submitted_at",{ascending:false}).limit(200),
  supabase.from("client_forms").select("id,template_name,status,updated_at").eq("firm_id",firm).eq("client_id",clientId).order("updated_at",{ascending:false})
 ]);
 if(client.error||templates.error||matters.error||intakes.error||saved.error)return <section className="page"><h1>Client forms setup required</h1><p>The form workflow database migration must be applied before client forms can be prepared.</p></section>;
 if(!client.data||templates.data.length!==templateIds.length)notFound();
 return <TemplatePreparation client={client.data} templates={templates.data} matters={matters.data||[]} intakes={intakes.data||[]} saved={saved.data||[]} canEdit={["admin","attorney","staff"].includes(c.profile!.role)}/>;
}
