import { describe, expect, it } from "vitest";
import {
  canSchedule, eventsForSlot, firmDateTime, firmDateTimeToIso, manualAppointmentRecord,
  manualAppointmentSchema, validDateKey, weekStart, weekWindow, type CalendarEvent,
} from "./calendar";

describe("Pride Law weekly calendar", () => {
  it("uses the current Eastern week even when the UTC date is already Monday", () => {
    const localDate = firmDateTime("2026-10-05T02:00:00Z").slice(0, 10);
    expect(localDate).toBe("2026-10-04");
    expect(weekStart(localDate)).toBe("2026-09-28");
    expect(weekStart("2026-10-08")).toBe("2026-10-05");
  });
  it("queries a Monday-to-Monday range across daylight saving changes", () => {
    expect(weekWindow("2026-10-26")).toEqual({ start: "2026-10-26T04:00:00.000Z", end: "2026-11-02T05:00:00.000Z" });
  });
  it("converts staff entries in Eastern Time in both summer and winter", () => {
    expect(firmDateTimeToIso("2026-10-08T09:30")).toBe("2026-10-08T13:30:00.000Z");
    expect(firmDateTimeToIso("2026-12-08T09:30")).toBe("2026-12-08T14:30:00.000Z");
    expect(() => firmDateTimeToIso("2026-03-08T02:30")).toThrow(/daylight/);
    expect(() => firmDateTimeToIso("2026-11-01T01:30")).toThrow(/daylight/);
    expect(() => firmDateTimeToIso("2026-02-30T09:00")).toThrow(/valid/);
    expect(validDateKey("2026-02-30")).toBe(false);
  });
  it("places off-grid start times in the correct half-hour slot", () => {
    const event = { id: "test", starts_at: "2026-10-08T13:45:00Z" } as CalendarEvent;
    expect(eventsForSlot([event], "2026-10-08", 570)).toEqual([event]);
    expect(eventsForSlot([event], "2026-10-08", 600)).toEqual([]);
    expect(eventsForSlot([event], "2026-10-09", 570)).toEqual([]);
  });
  it("stores staff contact details and a real end time without accepting a submitted firm id", () => {
    const parsed = manualAppointmentSchema.parse({
      name: " Jane Client ", startsAt: "2026-10-08T13:30:00Z", durationMinutes: 45,
      email: "jane@example.com", phone: "555-0100", eventType: "Client meeting", notes: "Bring documents.",
      firm_id: "another-firm", intake_id: "forged-intake",
    });
    expect(manualAppointmentRecord(parsed, "authorized-firm")).toMatchObject({
      firm_id: "authorized-firm", title: "Client meeting — Jane Client",
      starts_at: "2026-10-08T13:30:00.000Z", ends_at: "2026-10-08T14:15:00.000Z",
      notes: "Bring documents.\nEmail: jane@example.com\nPhone: 555-0100",
    });
    expect(parsed).not.toHaveProperty("intake_id");
    expect(manualAppointmentSchema.safeParse({ name: "", startsAt: "bad", durationMinutes: -1, eventType: "Other" }).success).toBe(false);
  });
  it("allows active staff to schedule and rejects readonly or inactive accounts", () => {
    expect(canSchedule({ role: "staff", status: "active" })).toBe(true);
    expect(canSchedule({ role: "readonly", status: "active" })).toBe(false);
    expect(canSchedule({ role: "admin", status: "disabled" })).toBe(false);
    expect(canSchedule({ role: "staff", status: "invited" })).toBe(false);
    expect(canSchedule(null)).toBe(false);
  });
});
