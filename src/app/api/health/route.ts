export const runtime = "edge";
export function GET(){ return Response.json({status:"ok",service:"WritRelay",stack:"Next.js + Supabase"}); }
