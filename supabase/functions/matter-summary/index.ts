import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
Deno.serve(async req => {
 if(req.method!=="POST") return new Response("Method not allowed",{status:405});
 const auth=req.headers.get("Authorization");if(!auth)return Response.json({error:"Unauthorized"},{status:401});
 const {matterId}=await req.json();if(!matterId)return Response.json({error:"matterId is required"},{status:400});
 const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,{global:{headers:{Authorization:auth}}});
 const [matter,tasks,events,documents]=await Promise.all([
  supabase.from("matters").select("*").eq("id",matterId).single(),
  supabase.from("tasks").select("title,status,due_date").eq("matter_id",matterId),
  supabase.from("events").select("title,starts_at,event_type").eq("matter_id",matterId),
  supabase.from("documents").select("name,status,document_type").eq("matter_id",matterId)
 ]);
 if(matter.error)return Response.json({error:matter.error.message},{status:404});
 return Response.json({matter:matter.data,summary:{openTasks:(tasks.data||[]).filter(x=>x.status!=="Completed").length,upcomingEvents:events.data||[],documents:documents.data||[]}});
});
