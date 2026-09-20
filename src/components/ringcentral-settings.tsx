"use client";

import { CheckCircle2, Link2, MessageSquareText, PhoneCall, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { useEffect, useState } from "react";

type Status = { configured: boolean; connected: boolean; isAdmin: boolean; extensionName: string | null; fromNumber: string | null; inboundEnabled: boolean };

export function RingCentralSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/ringcentral/status").then(async (response) => {
    const body = await response.json();
    if (!response.ok) setError(body.error || "Unable to load RingCentral status."); else setStatus(body);
  }); }, []);

  async function disconnect() {
    if (!window.confirm("Disconnect RingCentral? Existing client communication history will be kept.")) return;
    setBusy(true); setError("");
    const response = await fetch("/api/ringcentral/status", { method: "DELETE" });
    const body = await response.json(); setBusy(false);
    if (!response.ok) setError(body.error || "Unable to disconnect RingCentral.");
    else setStatus((current) => current ? { ...current, connected: false, extensionName: null, fromNumber: null, inboundEnabled: false } : current);
  }

  return <section className="page integration-page">
    <div className="page-head"><div><span className="eyebrow">FIRM INTEGRATIONS</span><h1>RingCentral</h1><p>Connect client calls and text messages to Pride Law records.</p></div></div>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="integration-layout">
      <div className="card integration-hero">
        <div className="integration-logo"><PhoneCall size={29}/></div>
        <div><span className="eyebrow">VOICE + SMS</span><h2>{status?.connected ? "RingCentral is connected" : "Connect RingCentral"}</h2><p>Staff can call and text from a client record. Inbound and outbound activity is saved with notes, summaries, and available recordings.</p></div>
        {!status ? <span className="loading-status"><RefreshCw size={15}/> Checking connection…</span> : status.connected ? <div className="connection-details"><span><CheckCircle2 size={16}/> Connected</span><strong>{status.extensionName || "RingCentral extension"}</strong><small>{status.fromNumber || "No assigned number"}</small><small>{status.inboundEnabled ? "Inbound sync enabled" : "Inbound webhook needs attention"}</small>{status.isAdmin && <button className="secondary" onClick={disconnect} disabled={busy}><Unplug size={14}/>{busy ? "Disconnecting…" : "Disconnect"}</button>}</div> : status.isAdmin ? <div className="connect-actions"><a className={`primary ${!status.configured ? "disabled" : ""}`} href={status.configured ? "/api/ringcentral/connect" : undefined}><Link2 size={15}/> Connect RingCentral</a>{!status.configured && <small>Add the RingCentral app credentials to the secure deployment settings first.</small>}</div> : <div className="connection-details"><small>Ask a firm administrator to connect RingCentral.</small></div>}
      </div>
      <div className="integration-capabilities">
        <div className="card"><PhoneCall size={20}/><strong>Inbound and outbound calls</strong><p>Call from a client record and automatically match incoming activity by phone number.</p></div>
        <div className="card"><MessageSquareText size={20}/><strong>Client text messages</strong><p>Send SMS and keep the conversation alongside the client’s case information.</p></div>
        <div className="card"><ShieldCheck size={20}/><strong>Protected records</strong><p>OAuth credentials remain server-only, and communication history follows firm access controls.</p></div>
      </div>
    </div>
  </section>;
}
