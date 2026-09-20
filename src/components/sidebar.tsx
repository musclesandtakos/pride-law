import Link from "next/link";
import { BriefcaseBusiness, CalendarDays, CheckSquare2, CircleDollarSign, ContactRound, FileText, FileType2, Gauge, History, Inbox, PhoneCall, Timer, TrendingUp, UsersRound } from "lucide-react";
import { signOut } from "@/app/login/actions";
const groups=[
  {label:"Daily work",items:[["/","Dashboard",Gauge],["/intakes","Intake & follow-up",Inbox],["/tasks","Tasks",CheckSquare2],["/events","Calendar",CalendarDays],["/clients","Clients",ContactRound],["/matters","Matters",BriefcaseBusiness]]},
  {label:"Firm tools",items:[["/documents","Documents",FileText],["/templates","Templates",FileType2],["/time-entries","Time entries",Timer],["/invoices","Invoices",CircleDollarSign],["/reports","Reports",TrendingUp]]},
  {label:"Administration",items:[["/settings/integrations/ringcentral","RingCentral",PhoneCall],["/users","Users",UsersRound],["/audit","Audit log",History]]},
] as const;
export function Sidebar({name,email}:{name:string;email:string}){return <aside className="sidebar"><Link href="/" className="brand"><span className="seal small">P</span><span><strong>PRIDE LAW</strong><small>Firm Operations</small></span></Link><nav>{groups.map(group=><div className="nav-group" key={group.label}><span className="nav-group-label">{group.label}</span>{group.items.map(([href,label,Icon])=><Link key={href} href={href}><Icon size={17}/>{label}</Link>)}</div>)}</nav><div className="workspace"><small>WORKSPACE</small><strong>Pride Law</strong><span>Wilton Manors, Florida</span></div><form action={signOut} className="profile"><span className="avatar">{name.split(" ").map(x=>x[0]).join("").slice(0,2)}</span><span><strong>{name}</strong><small>{email}</small></span><button title="Sign out">↗</button></form></aside>}
