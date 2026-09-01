import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resources, type ResourceKey } from "@/lib/resources";
export const runtime="edge";
const tableFor=(v:string)=>v in resources?resources[v as ResourceKey].table:null;
export async function PATCH(req:NextRequest,{params}:{params:Promise<{resource:string,id:string}>}){const {resource,id}=await params,table=tableFor(resource);if(!table)return Response.json({error:"Unknown resource"},{status:404});const body=await req.json();delete body.id;delete body.firm_id;const s=await createClient();const {data,error}=await s.from(table).update(body).eq("id",id).select().single();return error?Response.json({error:error.message},{status:400}):Response.json(data)}
export async function DELETE(_:NextRequest,{params}:{params:Promise<{resource:string,id:string}>}){const {resource,id}=await params,table=tableFor(resource);if(!table)return Response.json({error:"Unknown resource"},{status:404});const s=await createClient();const {error}=await s.from(table).delete().eq("id",id);return error?Response.json({error:error.message},{status:400}):Response.json({deleted:true})}
