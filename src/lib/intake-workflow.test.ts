import { describe, expect, it } from "vitest";
import { appointmentWindow, scheduleIntakeSchema } from "./intake-workflow";

describe("intake appointment workflow", () => {
  it("builds the end time from the selected duration", () => {
    expect(appointmentWindow("2026-09-21T14:00:00.000Z", 45)).toEqual({
      startsAt: "2026-09-21T14:00:00.000Z",
      endsAt: "2026-09-21T14:45:00.000Z",
    });
  });

  it("rejects appointments shorter than 15 minutes", () => {
    expect(scheduleIntakeSchema.safeParse({
      startsAt: "2026-09-21T14:00:00.000Z",
      durationMinutes: 10,
    }).success).toBe(false);
  });
});

