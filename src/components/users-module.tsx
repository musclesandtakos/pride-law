"use client";
import { useMemo, useRef, useState } from "react";
import { upsertMember, type WorkspaceMember } from "@/lib/member-list";

type Role = "admin" | "attorney" | "staff" | "billing" | "readonly";
type Member = WorkspaceMember;
type InviteResponse = Member & { invitation_reused?: boolean };
type TemporaryCredential = { name:string; password:string; expiresAt:string };
const roles: { value:Role; label:string }[] = [
  {value:"admin",label:"Administrator"},{value:"attorney",label:"Attorney"},
  {value:"staff",label:"Staff"},{value:"billing",label:"Billing"},{value:"readonly",label:"Read only"}
];

export function UsersModule({initial,currentUserId}:{initial:Member[];currentUserId:string}) {
  const [members,setMembers]=useState(initial),[query,setQuery]=useState(""),[open,setOpen]=useState(false);
  const [error,setError]=useState(""),[saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [issuing,setIssuing]=useState<string|null>(null),[credential,setCredential]=useState<TemporaryCredential|null>(null);
  const savingRef=useRef(false);
  const filtered=useMemo(()=>members.filter(member=>`${member.full_name} ${member.email} ${member.role}`.toLowerCase().includes(query.toLowerCase())),[members,query]);

  async function invite(formData:FormData) {
    if(savingRef.current)return;
    savingRef.current=true;setSaving(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(formData))});
      const body=await response.json() as InviteResponse & {error?:string};
      if(!response.ok){setError(body.error||"Unable to send invitation");return}
      setMembers(value=>upsertMember(value,body));setOpen(false);
      setNotice(body.invitation_reused
        ? `${body.email||"That email"} is already in the Pride Law workspace. No duplicate was created.`
        : `Invitation sent to ${body.email||"the new user"}.`);
    } catch {
      setError("The invitation could not be sent. Please check your connection and try again.");
    } finally {
      savingRef.current=false;setSaving(false);
    }
  }
  async function changeRole(id:string,role:string) {
    setError("");
    const response=await fetch("/api/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,role})});
    const body=await response.json();
    if(!response.ok){setError(body.error||"Unable to change role");return}
    setMembers(value=>value.map(member=>member.id===id?body:member));
  }
  async function issueTemporaryPassword(member:Member) {
    if(!window.confirm(`Replace ${member.email || member.full_name || "this user's"} current password with a 24-hour temporary password?`)) return;
    setError("");setIssuing(member.id);
    const response=await fetch("/api/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:member.id,action:"issue-temporary-password"})});
    const body=await response.json();setIssuing(null);
    if(!response.ok){setError(body.error||"Unable to issue temporary password");return}
    setMembers(value=>value.map(item=>item.id===member.id?{...item,must_change_password:true,temporary_password_expires_at:body.expiresAt}:item));
    setCredential({name:member.full_name||member.email||"User",password:body.temporaryPassword,expiresAt:body.expiresAt});
  }
  return <section className="page">
    <div className="page-head"><div><span className="eyebrow">ACCESS CONTROL</span><h1>Users</h1><p>Invite Pride Law team members and control their workspace permissions.</p></div><button className="primary" onClick={()=>{setError("");setNotice("");setOpen(true)}}>＋ Invite user</button></div>
    {error&&<div className="error page-error" role="alert">{error}</div>}
    {notice&&<div className="notice page-notice" aria-live="polite">{notice}</div>}
    <div className="toolbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search users…"/><span>{filtered.length} users</span></div>
    <div className="card table-card"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Added</th><th>Security</th></tr></thead><tbody>{filtered.map(member=><tr key={member.id}>
      <td><div className="user-cell"><span className="avatar">{initials(member.full_name||member.email||"U")}</span><strong>{member.full_name||"Unnamed user"}{member.id===currentUserId&&<small>YOU</small>}</strong></div></td>
      <td>{member.email||"—"}</td><td><select aria-label={`Role for ${member.full_name}`} value={member.role} onChange={event=>changeRole(member.id,event.target.value)} disabled={member.id===currentUserId}>{roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}</select></td>
      <td><span className={`pill ${member.status==="active"?"":"pending"}`}>{member.must_change_password?"password reset required":member.status}</span></td><td>{new Intl.DateTimeFormat("en-US",{dateStyle:"medium"}).format(new Date(member.created_at))}</td>
      <td><button type="button" className="secondary compact" disabled={member.status!=="active"||issuing===member.id} onClick={()=>issueTemporaryPassword(member)}>{issuing===member.id?"Issuing…":"24-hour password"}</button></td>
    </tr>)}</tbody></table></div>
    {open&&<div className="modal" role="dialog" aria-modal="true"><form action={invite} className="modal-card"><div><span className="eyebrow">NEW TEAM MEMBER</span><h2>Invite user</h2><p className="form-help">They’ll receive a secure email link to create their account.</p></div>{error&&<div className="error" role="alert">{error}</div>}<label>Full name<input name="fullName" autoComplete="name" required/></label><label>Email<input name="email" type="email" autoComplete="email" required/></label><label>Role<select name="role" defaultValue="staff">{roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}</select></label><div><button type="button" className="secondary" disabled={saving} onClick={()=>setOpen(false)}>Cancel</button><button className="primary" disabled={saving}>{saving?"Sending…":"Send invitation"}</button></div></form></div>}
    {credential&&<div className="modal" role="dialog" aria-modal="true"><div className="modal-card temporary-password-card"><div><span className="eyebrow">SHOW ONCE</span><h2>Temporary password for {credential.name}</h2><p className="form-help">Share this through a secure channel. It expires {new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short"}).format(new Date(credential.expiresAt))} and the user must replace it at sign in.</p></div><output>{credential.password}</output><div><button type="button" className="secondary" onClick={()=>navigator.clipboard.writeText(credential.password)}>Copy password</button><button type="button" className="primary" onClick={()=>setCredential(null)}>Done</button></div></div></div>}
  </section>;
}
function initials(value:string){return value.split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()}
