"use client";
import { useMemo, useState } from "react";

type Role = "admin" | "attorney" | "staff" | "billing" | "readonly";
type Member = { id:string; full_name:string|null; email:string|null; role:string; status:string; created_at:string };
const roles: { value:Role; label:string }[] = [
  {value:"admin",label:"Administrator"},{value:"attorney",label:"Attorney"},
  {value:"staff",label:"Staff"},{value:"billing",label:"Billing"},{value:"readonly",label:"Read only"}
];

export function UsersModule({initial,currentUserId}:{initial:Member[];currentUserId:string}) {
  const [members,setMembers]=useState(initial),[query,setQuery]=useState(""),[open,setOpen]=useState(false);
  const [error,setError]=useState(""),[saving,setSaving]=useState(false);
  const filtered=useMemo(()=>members.filter(member=>`${member.full_name} ${member.email} ${member.role}`.toLowerCase().includes(query.toLowerCase())),[members,query]);

  async function invite(formData:FormData) {
    setSaving(true);setError("");
    const response=await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(formData))});
    const body=await response.json();setSaving(false);
    if(!response.ok){setError(body.error||"Unable to send invitation");return}
    setMembers(value=>[...value,body]);setOpen(false);
  }
  async function changeRole(id:string,role:string) {
    setError("");
    const response=await fetch("/api/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,role})});
    const body=await response.json();
    if(!response.ok){setError(body.error||"Unable to change role");return}
    setMembers(value=>value.map(member=>member.id===id?body:member));
  }
  return <section className="page">
    <div className="page-head"><div><span className="eyebrow">ACCESS CONTROL</span><h1>Users</h1><p>Invite Pride Law team members and control their workspace permissions.</p></div><button className="primary" onClick={()=>{setError("");setOpen(true)}}>＋ Invite user</button></div>
    {error&&<div className="error page-error">{error}</div>}
    <div className="toolbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search users…"/><span>{filtered.length} users</span></div>
    <div className="card table-card"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Added</th></tr></thead><tbody>{filtered.map(member=><tr key={member.id}>
      <td><div className="user-cell"><span className="avatar">{initials(member.full_name||member.email||"U")}</span><strong>{member.full_name||"Unnamed user"}{member.id===currentUserId&&<small>YOU</small>}</strong></div></td>
      <td>{member.email||"—"}</td><td><select aria-label={`Role for ${member.full_name}`} value={member.role} onChange={event=>changeRole(member.id,event.target.value)} disabled={member.id===currentUserId}>{roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}</select></td>
      <td><span className={`pill ${member.status==="active"?"":"pending"}`}>{member.status}</span></td><td>{new Intl.DateTimeFormat("en-US",{dateStyle:"medium"}).format(new Date(member.created_at))}</td>
    </tr>)}</tbody></table></div>
    {open&&<div className="modal" role="dialog" aria-modal="true"><form action={invite} className="modal-card"><div><span className="eyebrow">NEW TEAM MEMBER</span><h2>Invite user</h2><p className="form-help">They’ll receive a secure email link to create their account.</p></div>{error&&<div className="error">{error}</div>}<label>Full name<input name="fullName" autoComplete="name" required/></label><label>Email<input name="email" type="email" autoComplete="email" required/></label><label>Role<select name="role" defaultValue="staff">{roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}</select></label><div><button type="button" className="secondary" onClick={()=>setOpen(false)}>Cancel</button><button className="primary" disabled={saving}>{saving?"Sending…":"Send invitation"}</button></div></form></div>}
  </section>;
}
function initials(value:string){return value.split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()}
