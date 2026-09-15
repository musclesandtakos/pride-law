"use client";

import { useMemo, useState } from "react";
import { Clipboard, Link2, ShieldCheck, XCircle } from "lucide-react";
import { practiceAreas } from "@/lib/intake-fields";

type IntakeLink = {
  id: string;
  recipient_name: string;
  recipient_email: string;
  practice_area: string | null;
  expires_at: string;
  submitted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  url?: string;
};

export function IntakeLinksModule({ initial }: { initial: IntakeLink[] }) {
  const [links, setLinks] = useState(initial);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const activeCount = useMemo(() => links.filter((link) => statusFor(link) === "Open").length, [links]);

  async function createLink(formData: FormData) {
    setSaving(true);
    setError("");
    const response = await fetch("/api/intake-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const body = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(body.error || "Unable to create the intake link.");
      return;
    }

    setLinks((current) => [body, ...current]);
    setNewUrl(body.url);
    setCopied(false);
    setOpen(false);
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  async function revokeLink(id: string) {
    setError("");
    const response = await fetch(`/api/intake-links/${id}`, { method: "PATCH" });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Unable to revoke the link.");
      return;
    }
    setLinks((current) => current.map((link) => link.id === id ? { ...link, ...body } : link));
  }

  return <section className="page">
    <div className="page-head">
      <div>
        <span className="eyebrow">CLIENT ONBOARDING</span>
        <h1>Intake links</h1>
        <p>Create secure, expiring forms for prospective clients.</p>
      </div>
      <button className="primary" onClick={() => { setError(""); setOpen(true); }}>＋ Create intake link</button>
    </div>

    <div className="intake-link-summary">
      <div className="card intake-summary-card"><Link2 size={20}/><span><strong>{activeCount}</strong><small>Open links</small></span></div>
      <div className="card intake-summary-card"><ShieldCheck size={20}/><span><strong>One-time</strong><small>Secure submission</small></span></div>
    </div>

    {newUrl && <div className="card new-intake-link" role="status">
      <div><span className="eyebrow">READY TO SEND</span><strong>Client intake link created</strong><p>Copy this link and send it only to the intended client.</p></div>
      <div className="copy-link-row"><input readOnly value={newUrl} aria-label="New client intake link"/><button className="primary" onClick={() => copyLink(newUrl)}><Clipboard size={15}/>{copied ? "Copied" : "Copy link"}</button></div>
    </div>}

    {error && <div className="error page-error">{error}</div>}

    <div className="card table-card">
      <table><thead><tr><th>Client</th><th>Practice area</th><th>Status</th><th>Expires</th><th>Created</th><th></th></tr></thead>
      <tbody>{links.length ? links.map((link) => {
        const status = statusFor(link);
        return <tr key={link.id}>
          <td><strong>{link.recipient_name}</strong><small className="table-subtext">{link.recipient_email}</small></td>
          <td>{link.practice_area || "—"}</td>
          <td><span className={`pill intake-status ${status.toLowerCase()}`}>{status}</span></td>
          <td>{formatDate(link.expires_at)}</td>
          <td>{formatDate(link.created_at)}</td>
          <td>{status === "Open" && <button className="icon-text-button" onClick={() => revokeLink(link.id)}><XCircle size={15}/> Revoke</button>}</td>
        </tr>;
      }) : <tr><td colSpan={6} className="empty-table-cell">No intake links yet. Create one when you are ready to onboard a client.</td></tr>}</tbody></table>
    </div>

    {open && <div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-intake-link-title">
      <form action={createLink} className="modal-card intake-link-modal">
        <div><span className="eyebrow">SECURE CLIENT FORM</span><h2 id="create-intake-link-title">Create intake link</h2><p className="form-help">The link works once and expires automatically.</p></div>
        {error && <div className="error">{error}</div>}
        <label>Client name<input name="recipientName" autoComplete="name" required/></label>
        <label>Client email<input name="recipientEmail" type="email" autoComplete="email" required/></label>
        <label>Practice area<select name="practiceArea" defaultValue="Personal Injury">{practiceAreas.map((area) => <option key={area}>{area}</option>)}</select></label>
        <label>Link expires<select name="expiresInDays" defaultValue="7"><option value="1">In 1 day</option><option value="3">In 3 days</option><option value="7">In 7 days</option><option value="14">In 14 days</option><option value="30">In 30 days</option></select></label>
        <div><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Creating…" : "Create link"}</button></div>
      </form>
    </div>}
  </section>;
}

function statusFor(link: IntakeLink) {
  if (link.submitted_at) return "Submitted";
  if (link.revoked_at) return "Revoked";
  if (new Date(link.expires_at).getTime() <= Date.now()) return "Expired";
  return "Open";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}
