"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, FileInput, RefreshCw } from "lucide-react";
import {
  addDays, eventsForSlot, firmDateTime, firmDateTimeToIso, formatCalendarTime, weekStart,
  type CalendarEvent, type CalendarIntake,
} from "@/lib/calendar";

function dayLabel(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
function slotLabel(minutes: number) {
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}
function appointmentTime(event: CalendarEvent) {
  if (!event.starts_at) return "Time not set";
  return `${formatCalendarTime(event.starts_at)}${event.ends_at ? ` – ${formatCalendarTime(event.ends_at)}` : ""}`;
}

type Booking = { startsAt: string; intakeId: string };

export function WeeklyCalendar({ monday, today, days, events, intakes, canEdit }: {
  monday: string; today: string; days: string[]; events: CalendarEvent[]; intakes: CalendarIntake[]; canEdit: boolean;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [detail, setDetail] = useState<CalendarEvent | null>(null);
  const [source, setSource] = useState<"intake" | "manual">("intake");
  const [intakeId, setIntakeId] = useState("");
  const [allHours, setAllHours] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const modalOpen = !!booking || !!detail;
  const selectedIntake = intakes.find((intake) => intake.id === intakeId);
  const visibleEvents = events.filter((event) => [event.title, event.location, event.event_type]
    .some((value) => value?.toLowerCase().includes(query.trim().toLowerCase())));
  const readyIntakes = intakes.filter((intake) => intake.stage !== "Appointment scheduled");
  const slots = Array.from({ length: allHours ? 48 : 20 }, (_, index) => (allHours ? 0 : 480) + index * 30);

  useEffect(() => {
    if (modalOpen && !dialog.current?.open) dialog.current?.showModal();
    if (!modalOpen && dialog.current?.open) dialog.current?.close();
  }, [modalOpen]);

  function closeModal() {
    if (saving) return;
    setBooking(null);
    setDetail(null);
    setError("");
  }
  function openBooking(dateTime?: string, intake?: CalendarIntake) {
    setError("");
    setNotice("");
    setDetail(null);
    setSource("intake");
    setIntakeId(intake?.id || "");
    setBooking({ startsAt: dateTime || `${days.includes(today) ? today : monday}T09:00`, intakeId: intake?.id || "" });
  }

  async function schedule(formData: FormData) {
    setError("");
    setSaving(true);
    try {
      const startsAt = firmDateTimeToIso(String(formData.get("startsAt") || ""));
      if (source === "intake" && !selectedIntake) throw new Error("Choose an intake before scheduling.");
      const response = await fetch(source === "intake" ? `/api/intakes/${intakeId}/appointment` : "/api/appointments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt, durationMinutes: Number(formData.get("durationMinutes")),
          location: String(formData.get("location") || ""), notes: String(formData.get("notes") || ""),
          ...(source === "manual" ? {
            name: String(formData.get("name") || ""), email: String(formData.get("email") || ""),
            phone: String(formData.get("phone") || ""), eventType: String(formData.get("eventType") || ""),
          } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save the appointment.");
      setBooking(null);
      setNotice(source === "intake" ? "Appointment saved. Intake and follow-up task updated." : "Staff appointment saved.");
      const targetWeek = weekStart(firmDateTime(startsAt).slice(0, 10));
      if (targetWeek !== monday) router.push(`/events?week=${targetWeek}`);
      else router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function eventButton(event: CalendarEvent) {
    return <button type="button" key={event.id} className={`calendar-appointment ${event.intake_id ? "from-intake" : "from-staff"}`}
      onClick={() => { setError(""); setDetail(event); }}>
      <strong>{event.title}</strong><span>{appointmentTime(event)}</span>
      {event.location && <span>{event.location}</span>}
      <small>{event.intake_id ? "From intake" : "Staff entry"}</small>
    </button>;
  }

  return <section className="page calendar-page">
    <div className="page-head calendar-heading">
      <div><span className="eyebrow">PRIDE LAW APPOINTMENTS</span><h1>Weekly calendar</h1>
        <p>Start with the client intake, choose a time, and schedule. Staff can also enter appointments manually.</p></div>
      {canEdit && <button className="primary" onClick={() => openBooking()}><CalendarPlus size={16}/> Schedule appointment</button>}
    </div>
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="calendar-toolbar">
      <div className="calendar-week-nav">
        <Link className="secondary" href={`/events?week=${addDays(monday, -7)}`} aria-label="Previous week"><ChevronLeft size={16}/></Link>
        <h2>{dayLabel(monday, { month: "short", day: "numeric", year: "numeric" })} – {dayLabel(days[6], { month: "short", day: "numeric", year: "numeric" })}</h2>
        <Link className="secondary" href={`/events?week=${addDays(monday, 7)}`} aria-label="Next week"><ChevronRight size={16}/></Link>
        <Link className="secondary" href="/events">This week</Link>
      </div>
      <div className="calendar-tools">
        <label><span className="sr-only">Search appointments</span><input placeholder="Search appointments" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
        <button className="secondary" onClick={() => router.refresh()} aria-label="Refresh calendar and submitted intakes"><RefreshCw size={16}/></button>
      </div>
    </div>
    <div className="calendar-caption"><span>Eastern Time · 30-minute scheduling slots</span>
      <label><input type="checkbox" checked={allHours} onChange={(event) => setAllHours(event.target.checked)}/> Show all hours</label></div>
    <div className="calendar-layout">
      <div className="card calendar-scroll" tabIndex={0} aria-label="Weekly calendar, scroll horizontally for all seven days">
        <table className="weekly-calendar">
          <caption className="sr-only">Appointments for the week beginning {monday}, Eastern Time</caption>
          <thead><tr><th scope="col">Time</th>{days.map((day) => <th scope="col" key={day} className={day === today ? "calendar-today" : ""}>
            <span>{dayLabel(day, { weekday: "short" })}</span><strong>{dayLabel(day, { month: "short", day: "numeric" })}</strong>
            {day === today && <small>Today</small>}
          </th>)}</tr></thead>
          <tbody>{slots.map((minutes) => <tr key={minutes}>
            <th scope="row">{formatCalendarTime(firmDateTimeToIso(`${monday}T${slotLabel(minutes)}`))}</th>
            {days.map((day) => <td key={day} className={day === today ? "calendar-today" : ""}>
              {eventsForSlot(visibleEvents, day, minutes).map(eventButton)}
              {canEdit && <button type="button" className="calendar-slot" onClick={() => openBooking(`${day}T${slotLabel(minutes)}`)}
                aria-label={`Schedule ${dayLabel(day, { weekday: "long", month: "short", day: "numeric" })} at ${slotLabel(minutes)} Eastern Time`}>+ Schedule</button>}
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <aside className="card calendar-intakes">
        <span className="eyebrow">INTAKE FIRST</span><h2>Ready to schedule</h2>
        <p>Submitted intake forms appear here for staff to review and book.</p>
        {readyIntakes.slice(0, 5).map((intake) => <div className="calendar-intake" key={intake.id}>
          <strong>{intake.name}</strong><span>{intake.practice_area || "Practice area pending"}</span>
          <small>{intake.email || intake.phone || "Contact details pending"}</small>
          {canEdit && <button className="secondary" onClick={() => openBooking(undefined, intake)}>Choose appointment time</button>}
        </div>)}
        {!readyIntakes.length && <p>No intakes waiting to be scheduled.</p>}
        <Link href="/intakes" className="calendar-text-link">View all intakes ({readyIntakes.length})</Link>
        {canEdit && <Link className="secondary" href="/intake-links"><FileInput size={15}/> Send intake form</Link>}
      </aside>
    </div>
    <div className="card calendar-agenda">
      <h2>Appointments this week ({visibleEvents.length})</h2><p>All appointment times are listed here, including those outside the displayed hours.</p>
      {visibleEvents.map((event) => <div className="calendar-agenda-row" key={event.id}>
        <span>{event.starts_at ? dayLabel(firmDateTime(event.starts_at).slice(0, 10), { weekday: "short", month: "short", day: "numeric" }) : "Undated"}</span>
        {eventButton(event)}
      </div>)}
      {!visibleEvents.length && <p role="status">{query ? "No appointments match your search." : "No appointments scheduled this week. Choose a time slot or schedule from an intake."}</p>}
    </div>

    <dialog ref={dialog} className="calendar-dialog" onCancel={(event) => { event.preventDefault(); closeModal(); }}>
      {booking && <form action={schedule} className="modal-card calendar-booking">
        <div><span className="eyebrow">APPOINTMENT SCHEDULING</span><h2>Schedule appointment</h2><p>All appointment times use Eastern Time.</p></div>
        <label>Information source<select value={source} disabled={saving} onChange={(event) => setSource(event.target.value as "intake" | "manual")}>
          <option value="intake">Client intake form</option><option value="manual">Manually entered by staff</option>
        </select></label>
        {source === "intake" ? <>
          <label>Client intake<select value={intakeId} required disabled={saving} onChange={(event) => setIntakeId(event.target.value)}>
            <option value="">Choose an intake</option>{intakes.map((intake) => <option value={intake.id} key={intake.id}>{intake.name} · {intake.practice_area || intake.stage}</option>)}
          </select></label>
          {selectedIntake ? <div className="calendar-client-summary"><strong>{selectedIntake.name}</strong>
            <span>{selectedIntake.email || "No email provided"}</span><span>{selectedIntake.phone || "No phone provided"}</span>
            <span>{selectedIntake.practice_area || "Practice area pending"}</span>
            <small>{selectedIntake.stage === "Appointment scheduled" ? "The existing upcoming initial consultation will be rescheduled." : "This books an initial consultation and completes the intake follow-up."}</small>
          </div> : <p>Choose a submitted intake to use its client details. <Link href="/intake-links">Send an intake form</Link> or select manual entry.</p>}
        </> : <div className="schedule-form-grid">
          <label className="wide">Client / attendee name<input name="name" required maxLength={200}/></label>
          <label>Email<input name="email" type="email" maxLength={254}/></label><label>Phone<input name="phone" type="tel" maxLength={50}/></label>
          <label className="wide">Appointment type<select name="eventType" defaultValue="Initial consultation">
            {["Initial consultation", "Client meeting", "Phone call", "Video conference", "Other"].map((type) => <option key={type}>{type}</option>)}
          </select></label>
        </div>}
        <div className="schedule-form-grid">
          <label className="wide">Date and time (Eastern)<input name="startsAt" type="datetime-local" defaultValue={booking.startsAt} required step={60}/></label>
          <label>Duration<select name="durationMinutes" defaultValue="30">
            {[15, 30, 45, 60, 90, 120].map((duration) => <option value={duration} key={duration}>{duration} minutes</option>)}
          </select></label>
          <label>Location<input name="location" defaultValue="Phone" list="calendar-locations" maxLength={300}/></label>
          <datalist id="calendar-locations"><option value="Phone"/><option value="Pride Law office"/><option value="Video conference"/></datalist>
          <label className="wide">Appointment notes<textarea name="notes" rows={3} maxLength={2000}/></label>
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        <div><button type="button" className="secondary" disabled={saving} onClick={closeModal}>Cancel</button>
          <button className="primary" disabled={saving || (source === "intake" && !selectedIntake)}>{saving ? "Saving…" : "Save appointment"}</button></div>
      </form>}
      {detail && <div className="modal-card calendar-booking">
        <div><span className="eyebrow">{detail.intake_id ? "FROM CLIENT INTAKE" : "STAFF ENTRY"}</span><h2>{detail.title}</h2></div>
        <p>{detail.starts_at && dayLabel(firmDateTime(detail.starts_at).slice(0, 10), { weekday: "long", month: "long", day: "numeric", year: "numeric" })}<br/>{appointmentTime(detail)} Eastern Time</p>
        <p>{detail.event_type}{detail.location ? ` · ${detail.location}` : ""}</p>
        {detail.intake_id && <div className="calendar-client-summary">{(() => {
          const intake = intakes.find((item) => item.id === detail.intake_id);
          return intake ? <><strong>{intake.name}</strong><span>{intake.email}</span><span>{intake.phone}</span><span>{intake.practice_area}</span></> : <span>Linked intake available in the intake pipeline.</span>;
        })()}</div>}
        {detail.notes && <p className="calendar-notes">{detail.notes}</p>}
        <div>{detail.intake_id && <Link className="secondary" href="/intakes">Open intake pipeline</Link>}
          {canEdit && detail.intake_id && intakes.some((intake) => intake.id === detail.intake_id) && <button className="primary" onClick={() => openBooking(detail.starts_at ? firmDateTime(detail.starts_at) : undefined, intakes.find((intake) => intake.id === detail.intake_id))}>Reschedule</button>}
          <button className="secondary" onClick={closeModal}>Close</button></div>
      </div>}
    </dialog>
  </section>;
}
