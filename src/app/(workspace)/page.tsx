import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
const cash=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
export default async function Dashboard(){
 const s=await createClient();const [matters,intakes,tasks,,time]=await Promise.all([
  s.from("matters").select("id,name,matter_number,practice_area,stage,priority,next_deadline").neq("stage","Closed"),
  s.from("intakes").select("id,stage"),s.from("tasks").select("id,title,due_date,status,priority").neq("status","Completed"),
  s.from("invoices").select("amount,balance,status"),s.from("time_entries").select("hours,rate,billed").eq("billed",false)
 ]);
 const unbilled=(time.data||[]).reduce((n,x)=>n+Number(x.hours)*Number(x.rate),0);
 return <section className="page dashboard-page"><div><div className="page-head"><div><span className="eyebrow">OPERATIONS OVERVIEW</span><h1>Good morning</h1><p>Here is what needs attention across the firm.</p></div><Link className="primary" href="/matters">View matters</Link></div><div className="metrics"><Metric label="Active matters" value={String(matters.data?.length||0)} note="Across all practice areas"/><Metric label="Open intakes" value={String((intakes.data||[]).filter(x=>!["Retained","Declined"].includes(x.stage)).length)} note="Prospects in pipeline"/><Metric label="Open tasks" value={String(tasks.data?.length||0)} note="Deadlines and follow-ups"/><Metric label="Unbilled work" value={cash(unbilled)} note="Ready for invoicing"/></div><div className="dashboard-grid"><article className="card"><div className="card-head"><h2>Priority matters</h2><Link href="/matters">View all →</Link></div>{(matters.data||[]).filter(x=>x.priority==="High").map(x=><div className="list-row" key={x.id}><span><strong>{x.name}</strong><small>{x.matter_number} · {x.practice_area}</small></span><span className="pill">{x.stage}</span></div>)}</article><article className="card"><div className="card-head"><h2>Upcoming tasks</h2><Link href="/tasks">View all →</Link></div>{(tasks.data||[]).slice(0,6).map(x=><div className="list-row" key={x.id}><span><strong>{x.title}</strong><small>Due {x.due_date||"Unscheduled"}</small></span><span className={"pill "+(x.priority==="High"?"danger":"")}>{x.priority}</span></div>)}</article></div></div><footer className="dashboard-footer">Created for Pride Law by Ignis Technologies</footer></section>
}
function Metric({label,value,note}:{label:string;value:string;note:string}){return <article className="card metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}
