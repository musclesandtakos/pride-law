"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, Clock3, FileInput, Mail, Phone, Search, UserRound } from "lucide-react";

type Intake = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  practice_area: string | null;
  source: string | null;
  stage: string;
  owner_name: string | null;
  notes: string | null;
  created_at: string;
};

type FollowUp = {
  id: string;
  intake_id: string | null;
  title: string;
  due_date: string | null;
  status: string;
  priority: string;
};

type Appointment = {
  id: string;
  intake_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
};

type View = "attention" | "scheduled" | "all" | "closed";

const closedStages = new Set(["Retained", "Declined"]);
const stageOptions = ["New", "Contacted", "Appointment scheduled", "Retained", "Declined"];

export function IntakeWorkflowModule({
  initialIntakes,
  initialTasks,
  initialAppointments,
}: {
  initialIntakes: Intake[];
  initialTasks: FollowUp[];
  initialAppointments: Appointment[];
}) {
  const [intakes, setIntakes] = useState(initialIntakes);
  const [tasks, setTasks] = useState(initialTasks);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [view, setView] = useState<View>("attention");
  const [query, setQuery] = useState("");
  const [scheduleFor, setScheduleFor] = useState<Intake | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const taskByIntake = useMemo(() => new Map(
    tasks.filter((task) => task.intake_id && task.status !== "Completed").map((task) => [task.intake_id as string, task]),
  ), [tasks]);
  const appointmentByIntake = useMemo(() => new Map(
    [...appointments].reverse().filter((event) => event.intake_id).map((event) => [event.intake_id as string, event]),
  ), [appointments]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return intakes.filter((intake) => {
      const matchesSearch = !needle || [intake.name, intake.email, intake.phone, intake.practice_area]
        .some((value) => value?.toLowerCase().includes(needle));
      if (!matchesSearch) return false;
      if (view === "attention") return !closedStages.has(intake.stage) && intake.stage !== "Appointment scheduled";
      if (view === "scheduled") return intake.stage === "Appointment scheduled";
      if (view === "closed") return closedStages.has(intake.stage);
      return true;
    });
  }, [intakes, query, view]);

  const openCount = intakes.filter((intake) => !closedStages.has(intake.stage)).length;
  const attentionCount = intakes.filter((intake) => !closedStages.has(intake.stage) && intake.stage !== "Appointment scheduled").length;
  const scheduledCount = intakes.filter((intake) => intake.stage === "Appointment scheduled").length;
  const followUpCount = tasks.filter((task) => task.intake_id && task.status !== "Completed").length;

  async function updateStage(intake: Intake, stage: string) {
    setSavingId(intake.id);
    setError("");
    const response = await fetch(`/api/resources/intakes/${intake.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    const body = await response.json();
    setSavingId(null);
    if (!response.ok) {
      setError(body.error || "Unable to update this intake.");
      return;
    }
    setIntakes((current) => current.map((row) => row.id === intake.id ? { ...row, stage } : row));
    if (["Appointment scheduled", "Retained", "Declined"].includes(stage)) {
      setTasks((current) => current.map((task) => task.intake_id === intake.id ? { ...task, status: "Completed" } : task));
    }
  }

  async function schedule(formData: FormData) {
    if (!scheduleFor) return;
    const localStart = String(formData.get("startsAt") || "");
    const start = new Date(localStart);
    if (!localStart || Number.isNaN(start.getTime())) {
      setError("Choose a valid appointment date and time.");
      return;
    }

    setSavingId(scheduleFor.id);
    setError("");
    const response = await fetch(`/api/intakes/${scheduleFor.id}/appointment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startsAt: start.toISOString(),
        durationMinutes: Number(formData.get("durationMinutes")),
        location: String(formData.get("location") || ""),
        notes: String(formData.get("notes") || ""),
      }),
    });
    const body = await response.json();
    setSavingId(null);
    if (!response.ok) {
      setError(body.error || "Unable to schedule the consultation.");
      return;
    }

    const intakeId = scheduleFor.id;
    setIntakes((current) => current.map((row) => row.id === intakeId ? { ...row, stage: "Appointment scheduled" } : row));
    setTasks((current) => current.map((task) => task.intake_id === intakeId ? { ...task, status: "Completed" } : task));
    setAppointments((current) => [{
      id: body.eventId,
      intake_id: intakeId,
      starts_at: body.startsAt,
      ends_at: body.endsAt,
      location: String(formData.get("location") || "") || null,
    }, ...current]);
    setScheduleFor(null);
    setView("scheduled");
  }

  return <section className="page intake-workflow-page">
    <div className="page-head intake-workflow-head">
      <div>
        <span className="eyebrow">NEW CLIENT WORKFLOW</span>
        <h1>Intake & follow-up</h1>
        <p>Every submitted form becomes a lead, a follow-up task, and a clear next action.</p>
      </div>
      <Link className="primary" href="/intake-links"><FileInput size={16}/> Send intake link</Link>
    </div>

    <div className="intake-workflow-strip" role="note">
      <CheckCircle2 size={18}/>
      <span><strong>Automatic workflow is on.</strong> A high-priority follow-up task is created when a client submits an intake.</span>
    </div>

    <div className="metrics intake-metrics">
      <button onClick={() => setView("attention")} className={view === "attention" ? "metric card active" : "metric card"}><span>Needs attention</span><strong>{attentionCount}</strong><small>New and contacted leads</small></button>
      <button onClick={() => setView("attention")} className="metric card"><span>Open follow-ups</span><strong>{followUpCount}</strong><small>Tasks ready for staff</small></button>
      <button onClick={() => setView("scheduled")} className={view === "scheduled" ? "metric card active" : "metric card"}><span>Consultations</span><strong>{scheduledCount}</strong><small>Appointments scheduled</small></button>
      <button onClick={() => setView("all")} className={view === "all" ? "metric card active" : "metric card"}><span>Active pipeline</span><strong>{openCount}</strong><small>All open intake records</small></button>
    </div>

    {error && <div className="error intake-workflow-error" role="alert">{error}</div>}

    <div className="intake-toolbar">
      <div className="intake-tabs" role="tablist" aria-label="Filter intake workflow">
        {(["attention", "scheduled", "all", "closed"] as View[]).map((option) => <button key={option} role="tab" aria-selected={view === option} onClick={() => setView(option)}>{tabLabel(option)}</button>)}
      </div>
      <label className="intake-search"><Search size={15}/><span className="sr-only">Search intakes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client, email, or phone"/></label>
    </div>

    <div className="intake-work-list">
      {visible.map((intake) => {
        const task = taskByIntake.get(intake.id);
        const appointment = appointmentByIntake.get(intake.id);
        return <article className="card intake-work-card" key={intake.id}>
          <div className="intake-person-icon"><UserRound size={20}/></div>
          <div className="intake-person">
            <div className="intake-card-title"><h2>{intake.name}</h2><span className={`pill stage-${slug(intake.stage)}`}>{intake.stage}</span></div>
            <p>{intake.practice_area || "Practice area not selected"} · Received {formatDate(intake.created_at)}</p>
            <div className="intake-contact">
              {intake.email ? <a href={`mailto:${intake.email}`}><Mail size={14}/>{intake.email}</a> : null}
              {intake.phone ? <a href={`tel:${intake.phone}`}><Phone size={14}/>{intake.phone}</a> : null}
            </div>
          </div>
          <div className="intake-next-step">
            {appointment?.starts_at ? <span className="workflow-detail scheduled"><CalendarPlus size={15}/><span><strong>Consultation</strong><small>{formatDateTime(appointment.starts_at)}{appointment.location ? ` · ${appointment.location}` : ""}</small></span></span>
              : task ? <span className="workflow-detail"><Clock3 size={15}/><span><strong>Follow-up task ready</strong><small>Due {task.due_date ? formatDate(task.due_date) : "soon"} · {task.priority} priority</small></span></span>
              : <span className="workflow-detail"><Clock3 size={15}/><span><strong>Next action needed</strong><small>Schedule a consultation or update the stage</small></span></span>}
          </div>
          <div className="intake-card-actions">
            {!closedStages.has(intake.stage) && <button className="primary compact" onClick={() => { setError(""); setScheduleFor(intake); }}><CalendarPlus size={15}/>{appointment ? "Reschedule" : "Schedule"}</button>}
            <label className="stage-select"><span>Stage</span><select value={intake.stage} disabled={savingId === intake.id} onChange={(event) => updateStage(intake, event.target.value)}>{stageOptions.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
          </div>
        </article>;
      })}
      {!visible.length && <div className="card intake-empty"><CheckCircle2 size={28}/><h2>Nothing waiting here</h2><p>New client submissions will appear automatically.</p></div>}
    </div>

    {scheduleFor && <div className="modal" role="dialog" aria-modal="true" aria-labelledby="schedule-intake-title">
      <form action={schedule} className="modal-card schedule-intake-modal">
        <div><span className="eyebrow">INITIAL CONSULTATION</span><h2 id="schedule-intake-title">Schedule {scheduleFor.name}</h2><p>This adds the appointment to the calendar and updates the intake automatically.</p></div>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="schedule-form-grid">
          <label className="wide">Date and time<input name="startsAt" type="datetime-local" required/></label>
          <label>Duration<select name="durationMinutes" defaultValue="30"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">90 minutes</option></select></label>
          <label>Location<select name="location" defaultValue="Phone"><option>Phone</option><option>Office</option><option>Video conference</option><option>Client location</option></select></label>
          <label className="wide">Notes<textarea name="notes" rows={3} placeholder="Anything the team should know before the consultation"/></label>
        </div>
        <div><button type="button" className="secondary" onClick={() => { setScheduleFor(null); setError(""); }}>Cancel</button><button className="primary" disabled={savingId === scheduleFor.id}>{savingId === scheduleFor.id ? "Scheduling…" : "Add to calendar"}</button></div>
      </form>
    </div>}
  </section>;
}

function tabLabel(view: View) {
  return { attention: "Needs attention", scheduled: "Scheduled", all: "All intakes", closed: "Closed" }[view];
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
