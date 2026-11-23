import { z } from "zod";
import { appointmentWindow, scheduleIntakeSchema } from "./intake-workflow";

export const FIRM_TIME_ZONE = "America/New_York";
export type CalendarIntake = {
  id: string; name: string; email: string | null; phone: string | null;
  practice_area: string | null; stage: string;
};
export type CalendarEvent = {
  id: string; title: string; starts_at: string | null; ends_at: string | null;
  event_type: string | null; location: string | null; notes: string | null; intake_id: string | null;
};

export function canSchedule(profile: { role: string; status: string } | null) {
  return profile?.status === "active" && ["admin", "attorney", "staff", "billing"].includes(profile.role);
}

export function firmDateTime(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FIRM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function validDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

export function addDays(date: string, count: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

export function weekStart(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -(weekday + 6) % 7);
}

// Convert a wall-clock entry in the firm's timezone, regardless of the staff member's browser timezone.
// Try both Eastern offsets and require a round trip. DST gaps and ambiguous times need an explicit choice.
export function firmDateTimeToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !validDateKey(value.slice(0, 10))) {
    throw new Error("Choose a valid date and time.");
  }
  const candidates = ["-04:00", "-05:00"].map((offset) => new Date(value + offset))
    .filter((date) => !Number.isNaN(date.getTime()) && firmDateTime(date) === value);
  if (candidates.length !== 1) throw new Error("This time changes with daylight saving time. Choose another time.");
  return candidates[0].toISOString();
}

export function weekWindow(monday: string) {
  return { start: firmDateTimeToIso(`${monday}T00:00`), end: firmDateTimeToIso(`${addDays(monday, 7)}T00:00`) };
}

export function formatCalendarTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: FIRM_TIME_ZONE, hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

export function eventsForSlot(events: CalendarEvent[], date: string, minutes: number) {
  return events.filter((event) => {
    if (!event.starts_at) return false;
    const local = firmDateTime(event.starts_at);
    const startMinutes = Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
    return local.slice(0, 10) === date && startMinutes >= minutes && startMinutes < minutes + 30;
  });
}

export const manualAppointmentSchema = scheduleIntakeSchema.extend({
  name: z.string().trim().min(1).max(200),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).default(""),
  phone: z.string().trim().max(50).default(""),
  eventType: z.enum(["Initial consultation", "Client meeting", "Phone call", "Video conference", "Other"]),
});

export function manualAppointmentRecord(value: z.infer<typeof manualAppointmentSchema>, firmId: string) {
  const window = appointmentWindow(value.startsAt, value.durationMinutes);
  return {
    firm_id: firmId, title: `${value.eventType} — ${value.name}`, event_type: value.eventType,
    starts_at: window.startsAt, ends_at: window.endsAt, location: value.location || null,
    notes: [value.notes, value.email && `Email: ${value.email}`, value.phone && `Phone: ${value.phone}`]
      .filter(Boolean).join("\n") || null,
  };
}
