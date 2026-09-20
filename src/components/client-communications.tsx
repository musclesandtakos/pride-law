"use client";

import Link from "next/link";
import { ArrowLeft, FileAudio, MessageSquareText, NotebookPen, PhoneCall, Save, Send, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

type Client = { id: string; name: string; email: string | null; phone: string | null; preferred_contact: string | null; status: string };
type Communication = {
  id: string; channel: "call" | "sms" | "note"; direction: "inbound" | "outbound" | "internal"; status: string;
  from_number: string | null; to_number: string | null; subject: string | null; notes: string | null; summary: string | null;
  duration_seconds: number | null; recording_available: boolean; started_at: string;
};

export function ClientCommunications({ client, initialCommunications, ringCentral }: {
  client: Client;
  initialCommunications: Communication[];
  ringCentral: { configured: boolean; connected: boolean; fromNumber: string | null };
}) {
  const [communications, setCommunications] = useState(initialCommunications);
  const [message, setMessage] = useState("");
  const [callNote, setCallNote] = useState("");
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState<"call" | "sms" | "note" | "" >("");
  const [error, setError] = useState("");
  const calls = useMemo(() => communications.filter((item) => item.channel === "call").length, [communications]);
  const texts = useMemo(() => communications.filter((item) => item.channel === "sms").length, [communications]);

  async function submit(endpoint: string, payload: object, action: "call" | "sms" | "note") {
    setBusy(action); setError("");
    const response = await fetch(`/api/clients/${client.id}/communications${endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const body = await response.json();
    setBusy("");
    if (!response.ok) { setError(body.error || "Unable to complete that action."); return; }
    setCommunications((current) => [body, ...current.filter((item) => item.id !== body.id)]);
    if (action === "sms") setMessage("");
    if (action === "call") setCallNote("");
    if (action === "note") { setNote(""); setSummary(""); }
  }

  return <section className="page communications-page">
    <Link href="/clients" className="back-link dark"><ArrowLeft size={15}/> Back to clients</Link>
    <div className="page-head communications-head">
      <div><span className="eyebrow">CLIENT COMMUNICATIONS</span><h1>{client.name}</h1><p>{client.phone || "No phone number"} · {client.email || "No email address"}</p></div>
      <span className={`connection-pill ${ringCentral.connected ? "connected" : ""}`}>{ringCentral.connected ? "● RingCentral connected" : "○ RingCentral not connected"}</span>
    </div>

    {!ringCentral.connected && <div className="communications-alert"><PhoneCall size={18}/><span><strong>Connect RingCentral to call or text from this record.</strong><small>Notes and summaries are still available now.</small></span><Link href="/settings/integrations/ringcentral">Open setup</Link></div>}
    {error && <div className="error communications-error" role="alert">{error}</div>}

    <div className="communications-metrics">
      <div className="card"><span>Calls</span><strong>{calls}</strong><small>Inbound and outbound</small></div>
      <div className="card"><span>Text messages</span><strong>{texts}</strong><small>Linked to this client</small></div>
      <div className="card"><span>Preferred contact</span><strong className="metric-text">{client.preferred_contact || "Not set"}</strong><small>{client.status}</small></div>
    </div>

    <div className="communications-layout">
      <div className="communications-actions">
        <div className="card communication-action-card">
          <div className="card-head"><h2><PhoneCall size={17}/> Place a call</h2></div>
          <p>RingCentral first calls your staff line, then connects you to {client.name}.</p>
          <label>Optional note<textarea value={callNote} onChange={(event) => setCallNote(event.target.value)} rows={3} placeholder="Purpose of the call or follow-up details"/></label>
          <button className="primary" disabled={!ringCentral.connected || !client.phone || Boolean(busy)} onClick={() => submit("/call", { notes: callNote }, "call")}><PhoneCall size={15}/>{busy === "call" ? "Starting call…" : `Call ${client.phone || "client"}`}</button>
        </div>
        <div className="card communication-action-card">
          <div className="card-head"><h2><MessageSquareText size={17}/> Send a text</h2><span>{message.length}/1000</span></div>
          <label>Message<textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, 1000))} rows={5} placeholder={`Write a text to ${client.name}`}/></label>
          <button className="primary" disabled={!ringCentral.connected || !client.phone || !message.trim() || Boolean(busy)} onClick={() => submit("/sms", { message }, "sms")}><Send size={15}/>{busy === "sms" ? "Sending…" : "Send text"}</button>
        </div>
        <div className="card communication-action-card">
          <div className="card-head"><h2><NotebookPen size={17}/> Add note or summary</h2></div>
          <label>Call notes<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Key details, next steps, or commitments"/></label>
          <label>Call summary<textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} placeholder="Concise summary for the client record"/></label>
          <button className="secondary" disabled={!note.trim() && !summary.trim() || Boolean(busy)} onClick={() => submit("", { notes: note, summary }, "note")}><Save size={15}/>{busy === "note" ? "Saving…" : "Save to client record"}</button>
        </div>
      </div>

      <div className="card communication-timeline">
        <div className="card-head"><div><span className="eyebrow">ACTIVITY</span><h2>Communication history</h2></div><span>{communications.length} items</span></div>
        {!communications.length ? <div className="communications-empty"><MessageSquareText size={28}/><strong>No communications yet</strong><p>Calls, texts, notes, summaries, and recordings will appear here.</p></div> : communications.map((item) => <article className="communication-item" key={item.id}>
          <div className={`communication-icon ${item.channel}`}>{item.channel === "call" ? <PhoneCall size={16}/> : item.channel === "sms" ? <MessageSquareText size={16}/> : <NotebookPen size={16}/>}</div>
          <div className="communication-body">
            <div><strong>{titleFor(item)}</strong><span className="communication-status">{item.status}</span><time>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.started_at))}</time></div>
            {item.subject && <p className="message-copy">{item.subject}</p>}
            {item.notes && <p><b>Notes:</b> {item.notes}</p>}
            {item.summary && <p><b>Summary:</b> {item.summary}</p>}
            {item.recording_available && <a className="recording-link" href={`/api/clients/${client.id}/communications/${item.id}/recording`} target="_blank" rel="noreferrer"><FileAudio size={14}/> Play recording</a>}
          </div>
        </article>)}
      </div>
    </div>
    <div className="recording-notice"><ShieldCheck size={16}/><span>Recording availability depends on RingCentral settings. Follow applicable call-recording consent laws and firm policy before recording.</span></div>
  </section>;
}

function titleFor(item: Communication) {
  if (item.channel === "note") return "Internal note";
  return `${item.direction === "inbound" ? "Inbound" : "Outbound"} ${item.channel === "call" ? "call" : "text"}`;
}
